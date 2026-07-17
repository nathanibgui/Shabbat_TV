#!/usr/bin/env python3
"""
ShabbatTV Hub Agent
===================
Agent hub portable : maintient une connexion WebSocket SORTANTE vers le VPS
(aucune ouverture de port / config box necessaire), recoit les ordres du
scheduler cloud (start/stop/command) et pilote les TV en LOCAL via pyatv.

C'est le meme role que joue l'app SmartThings : l'appareil qui execute est
sur le reseau local, le cloud ne fait que coordonner.

Concu pour tourner :
  - Sur un PC (des maintenant)          : python hub_agent.py
  - Dans l'app Android (Chaquopy)       : import hub_agent; hub_agent.run_embedded(url, token)
  - Sur un Raspberry Pi (plus tard)     : service systemd

Usage:
    python hub_agent.py --login EMAIL          # login VPS, sauvegarde le token
    python hub_agent.py                        # demarre l'agent (hub_config.json)
    python hub_agent.py --url URL --token TOK  # override manuel
    python hub_agent.py --devices              # liste les appareils locaux

Protocole (JSON sur WebSocket) :
    Agent -> VPS : auth{role:hub}, ping, hub_status, command_result, event
    VPS -> Agent : auth_ok, pong, start{shabbat_times}, stop, command{device_id,command},
                   status_request, notification
"""

import argparse
import asyncio
import json
import logging
import os
import platform
import sqlite3
import sys
from datetime import datetime, timedelta
from pathlib import Path

try:
    import aiohttp
except ImportError:
    print("Erreur: aiohttp n'est pas installe.  pip install aiohttp")
    sys.exit(1)

AGENT_VERSION = "1.0.0"
SCRIPT_DIR = Path(__file__).parent
DB_PATH = SCRIPT_DIR / "shabbat.db"
CONFIG_PATH = SCRIPT_DIR / "hub_config.json"

DEFAULT_VPS_URL = os.getenv("SHABBAT_VPS_URL", "https://shabbat.nathanibgui.com")

PING_INTERVAL = 25          # Secondes entre pings keepalive
STATUS_INTERVAL = 30        # Secondes entre envois de hub_status
RECONNECT_DELAYS = [2, 5, 10, 20, 30, 60]  # Backoff reconnexion VPS
DEFAULT_DURATION_HOURS = 14  # Duree par defaut si pas d'horaires fournis
HAVDALAH_MARGIN_MIN = 30     # Marge apres havdalah

ALLOWED_COMMANDS = {
    "play", "pause", "play_pause", "select",
    "up", "down", "left", "right", "menu", "home",
}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("hub_agent")


# ── Config ────────────────────────────────────────

def load_config():
    """Charge hub_config.json. Env vars prioritaires."""
    config = {}
    if CONFIG_PATH.exists():
        try:
            config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        except Exception as e:
            log.warning(f"hub_config.json illisible: {e}")
    url = os.getenv("SHABBAT_VPS_URL") or config.get("vps_url") or DEFAULT_VPS_URL
    token = os.getenv("SHABBAT_HUB_TOKEN") or config.get("token")
    return url, token


def save_config(vps_url, token):
    CONFIG_PATH.write_text(
        json.dumps({"vps_url": vps_url, "token": token}, indent=2),
        encoding="utf-8",
    )
    log.info(f"Config sauvegardee: {CONFIG_PATH}")


def ws_url_from(vps_url):
    """https://host -> wss://host/ws (gere aussi http/localhost)."""
    base = vps_url.rstrip("/")
    if base.startswith("https://"):
        return "wss://" + base[len("https://"):] + "/ws"
    if base.startswith("http://"):
        return "ws://" + base[len("http://"):] + "/ws"
    if base.startswith(("ws://", "wss://")):
        return base + ("/ws" if not base.endswith("/ws") else "")
    return "wss://" + base + "/ws"


# ── DB locale (stdlib uniquement — pas besoin de pyatv) ──

def db_migrate():
    """Migrations legeres du schema local (idempotent)."""
    if not DB_PATH.exists():
        return
    try:
        conn = sqlite3.connect(str(DB_PATH))
        cols = [r[1] for r in conn.execute("PRAGMA table_info(devices)")]
        if cols and "type" not in cols:
            conn.execute("ALTER TABLE devices ADD COLUMN type TEXT "
                         "NOT NULL DEFAULT 'appletv'")
            conn.commit()
            log.info("Migration: colonne devices.type ajoutee")
        conn.close()
    except Exception as e:
        log.warning(f"Migration DB echouee: {e}")


def db_list_devices(enabled_only=True):
    """Liste les appareils appaires localement (shabbat.db)."""
    if not DB_PATH.exists():
        return []
    try:
        conn = sqlite3.connect(str(DB_PATH))
        conn.row_factory = sqlite3.Row
        query = "SELECT * FROM devices"
        if enabled_only:
            query += " WHERE enabled=1"
        rows = conn.execute(query + " ORDER BY id").fetchall()
        conn.close()
        result = []
        for r in rows:
            d = dict(r)
            try:
                d["credentials"] = json.loads(d.get("credentials") or "{}")
            except Exception:
                d["credentials"] = {}
            d.setdefault("type", "appletv")  # anciens schemas sans colonne type
            result.append(d)
        return result
    except Exception as e:
        log.warning(f"Lecture DB echouee: {e}")
        return []


def db_get_device(device_id):
    for d in db_list_devices(enabled_only=False):
        if d["id"] == device_id:
            return d
    return None


def db_get_ntfy_topic():
    try:
        conn = sqlite3.connect(str(DB_PATH))
        row = conn.execute(
            "SELECT value FROM settings WHERE key='ntfy_topic'"
        ).fetchone()
        conn.close()
        return row[0] if row else None
    except Exception:
        return None


# ── Horaires ──────────────────────────────────────

def parse_end_time(shabbat_times):
    """Calcule l'heure de fin locale (naive) : havdalah + marge."""
    if not shabbat_times:
        return None
    havdalah = shabbat_times.get("havdalah")
    if not havdalah:
        return None
    try:
        dt = datetime.fromisoformat(havdalah.replace("Z", "+00:00"))
        if dt.tzinfo:
            dt = dt.astimezone().replace(tzinfo=None)  # -> heure locale naive
        return dt + timedelta(minutes=HAVDALAH_MARGIN_MIN)
    except Exception as e:
        log.warning(f"Horaire havdalah invalide ({havdalah}): {e}")
        return None


# ── Notifier ──────────────────────────────────────

class NullNotifier:
    """Notifier muet — utilise si shabbat_auto (pyatv) est indisponible."""
    enabled = False

    async def send(self, *a, **k): pass
    async def notify_connected(self, *a, **k): pass
    async def notify_disconnected(self, *a, **k): pass
    async def notify_action(self, *a, **k): pass
    async def notify_finished(self, *a, **k): pass
    async def notify_error(self, *a, **k): pass


def make_notifier():
    """Notifier ntfy.sh si possible, sinon muet."""
    try:
        from shabbat_auto import Notifier
        return Notifier(db_get_ntfy_topic())
    except (SystemExit, ImportError):
        return NullNotifier()


# ── Agent ─────────────────────────────────────────

class HubAgent:
    """
    Connexion sortante persistante vers le VPS + execution locale.
    self.sessions : {device_id: {"controller": ShabbatController, "task": Task}}
    """

    def __init__(self, vps_url, token):
        self.vps_url = vps_url
        self.token = token
        self.ws = None
        self.sessions = {}
        self.running = True
        self.shabbat_active = False

    # ── Envoi ──

    async def send(self, message: dict):
        if self.ws is not None and not self.ws.closed:
            try:
                await self.ws.send_json(message)
            except Exception as e:
                log.warning(f"Envoi WS echoue: {e}")

    async def send_event(self, message, device_id=None):
        await self.send({
            "type": "event",
            "device_id": device_id,
            "message": message,
            "timestamp": datetime.now().isoformat(),
        })

    async def send_status(self):
        devices = []
        for d in db_list_devices(enabled_only=False):
            session = self.sessions.get(d["id"])
            controller = session["controller"] if session else None
            devices.append({
                "id": d["id"],
                "name": d["name"],
                "address": d["address"],
                "type": d.get("type", "appletv"),
                "enabled": bool(d.get("enabled", 1)),
                "script_running": controller is not None and controller.running,
                "connected": bool(controller and controller.apple_tv),
                "select_count": controller.press_count if controller else 0,
            })
        await self.send({
            "type": "hub_status",
            "shabbat_active": self.shabbat_active,
            "devices": devices,
            "version": AGENT_VERSION,
            "platform": platform.system().lower(),
        })

    # ── Mode Shabbat ──

    def _make_monitor(self, device, notifier, duration):
        """Choisit le bon moniteur selon le type d'appareil.

        - appletv : ShabbatController (event-driven pyatv PushUpdater)
        - autres (chromecast, androidtv, firetv, roku...) : UniversalMonitor
          (polling via l'interface DeviceController generique)
        """
        dtype = device.get("type", "appletv")

        if dtype == "appletv":
            from shabbat_auto import ShabbatController  # requiert pyatv
            return ShabbatController(
                device, notifier,
                duration_hours=duration, fallback_minutes=25,
            )

        from controllers.base import DeviceType
        from controllers.factory import create_controller
        from universal_monitor import UniversalMonitor
        controller = create_controller(
            DeviceType(dtype),
            address=device["address"],
            identifier=device["identifier"],
            name=device["name"],
        )
        return UniversalMonitor(device, controller, notifier)

    async def start_shabbat(self, shabbat_times=None, duration_hours=None):
        """Demarre le monitoring sur tous les appareils actifs."""
        if self.shabbat_active:
            log.info("Mode Shabbat deja actif — ignore")
            return

        devices = db_list_devices(enabled_only=True)
        if not devices:
            log.warning("Aucun appareil actif — rien a demarrer")
            await self.send_event("Aucun appareil actif sur le hub")
            return

        end_time = parse_end_time(shabbat_times)
        if end_time is None:
            hours = duration_hours or DEFAULT_DURATION_HOURS
            end_time = datetime.now() + timedelta(hours=hours)
        duration = (end_time - datetime.now()).total_seconds() / 3600
        if duration <= 0:
            log.warning(f"Heure de fin deja passee ({end_time}) — ignore")
            return

        notifier = make_notifier()
        self.shabbat_active = True
        log.info(f"=== Mode Shabbat ACTIVE ({len(devices)} appareil(s), "
                 f"fin {end_time.strftime('%a %d/%m %H:%M')}) ===")

        for device in devices:
            dtype = device.get("type", "appletv")
            # Les credentials ne sont requis que pour Apple TV (appairage PIN) ;
            # Roku/ADB/Chromecast se connectent directement par IP.
            if dtype == "appletv" and not device["credentials"]:
                log.warning(f"  {device['name']}: pas de credentials, saute")
                continue
            try:
                monitor = self._make_monitor(device, notifier, duration)
            except (SystemExit, ImportError, ValueError) as e:
                log.error(f"  {device['name']} ({dtype}): moniteur indisponible "
                          f"({e or 'dependance manquante'})")
                await self.send_event(
                    f"Impossible de surveiller {device['name']} ({dtype}): "
                    f"dependance manquante", device["id"]
                )
                continue
            task = asyncio.create_task(
                self._run_controller(device, monitor, end_time)
            )
            self.sessions[device["id"]] = {"controller": monitor, "task": task}
            log.info(f"  Monitoring demarre: {device['name']} "
                     f"(#{device['id']}, {dtype})")

        if not self.sessions:
            self.shabbat_active = False
            await self.send_event("Aucun appareil n'a pu etre surveille")
            await self.send_status()
            return

        await self.send_event(
            f"Mode Shabbat active ({len(self.sessions)} appareil(s))"
        )
        await self.send_status()

    async def _run_controller(self, device, controller, end_time):
        """Enveloppe la boucle du controleur pour notifier le VPS a la fin."""
        try:
            await controller.run(end_time)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            log.error(f"Controleur {device['name']} crashe: {e}")
            await self.send_event(f"Erreur {device['name']}: {e}", device["id"])
        finally:
            self.sessions.pop(device["id"], None)
            if not self.sessions:
                self.shabbat_active = False
            await self.send_status()

    async def stop_shabbat(self, reason="Arret demande"):
        if not self.sessions:
            self.shabbat_active = False
            return
        log.info(f"=== Mode Shabbat ARRETE ({reason}) ===")
        for device_id, session in list(self.sessions.items()):
            controller = session["controller"]
            controller.running = False
            controller.connection_lost_event.set()  # reveille la boucle
        # Laisse 10s aux boucles pour se terminer proprement, puis cancel
        await asyncio.sleep(0)
        for device_id, session in list(self.sessions.items()):
            task = session["task"]
            try:
                await asyncio.wait_for(asyncio.shield(task), timeout=10)
            except (asyncio.TimeoutError, Exception):
                task.cancel()
        self.sessions.clear()
        self.shabbat_active = False
        await self.send_event(f"Mode Shabbat arrete: {reason}")
        await self.send_status()

    # ── Commandes ponctuelles ──

    async def run_command(self, device_id, command):
        """Execute une commande one-shot (play, select...) sur un appareil."""
        result = {"type": "command_result", "device_id": device_id,
                  "command": command, "success": False}

        if command not in ALLOWED_COMMANDS:
            result["error"] = f"Commande inconnue: {command}"
            await self.send(result)
            return

        device = db_get_device(device_id)
        if not device:
            result["error"] = f"Appareil #{device_id} introuvable"
            await self.send(result)
            return

        try:
            # Si un controleur tourne et est connecte, reutilise sa connexion
            session = self.sessions.get(device_id)
            if session and session["controller"].apple_tv:
                remote = session["controller"].apple_tv.remote_control
                await getattr(remote, command)()
            else:
                await self._ephemeral_command(device, command)
            result["success"] = True
            log.info(f"Commande {command} OK sur {device['name']}")
        except Exception as e:
            result["error"] = str(e)
            log.warning(f"Commande {command} echouee sur {device['name']}: {e}")

        await self.send(result)

    async def _ephemeral_command(self, device, command):
        """Connexion ephemere pour une commande unique (tout type d'appareil)."""
        dtype = device.get("type", "appletv")

        if dtype == "appletv":
            from shabbat_auto import find_apple_tv
            import pyatv
            conf = await find_apple_tv(device)
            if not conf:
                raise RuntimeError("Apple TV introuvable sur le reseau")
            atv = await pyatv.connect(conf, asyncio.get_running_loop())
            try:
                await getattr(atv.remote_control, command)()
            finally:
                atv.close()
            return

        from controllers.base import DeviceType
        from controllers.factory import create_controller
        controller = create_controller(
            DeviceType(dtype),
            address=device["address"],
            identifier=device["identifier"],
            name=device["name"],
        )
        if not await controller.connect(device.get("credentials") or {}):
            raise RuntimeError(f"Connexion a {device['name']} ({dtype}) echouee")
        try:
            await getattr(controller, command)()
        finally:
            await controller.disconnect()

    # ── Scan reseau multi-plateformes ──

    async def run_scan(self, timeout=8.0):
        """Balaye le reseau local : Apple TV, Chromecast, Android TV/Fire TV,
        Roku — et renvoie tout ce qui est trouve au VPS."""
        log.info(f"Scan reseau ({timeout}s)...")
        try:
            from controllers.factory import scan_all_devices
            found = await scan_all_devices(timeout=timeout)
        except Exception as e:
            log.error(f"Scan echoue: {e}")
            await self.send({"type": "scan_result", "success": False,
                             "error": str(e), "devices": []})
            return

        known = {d["identifier"] for d in db_list_devices(enabled_only=False)}
        devices = [{
            "name": d.name,
            "address": d.address,
            "identifier": d.identifier,
            "type": d.device_type.value,
            "protocols": d.protocols,
            "model": d.model,
            "manufacturer": d.manufacturer,
            "already_paired": d.identifier in known,
        } for d in found]

        log.info(f"Scan termine: {len(devices)} appareil(s) trouve(s)")
        await self.send({"type": "scan_result", "success": True,
                         "devices": devices})

    # ── Reception ──

    async def handle_message(self, data: dict):
        msg_type = data.get("type")

        if msg_type == "auth_ok":
            log.info(f"Authentifie aupres du VPS (user {data.get('user_id')})")
            await self.send_status()

        elif msg_type == "auth_error":
            log.error(f"Auth refusee: {data.get('message')} — token expire ?")
            log.error("Relancez: python hub_agent.py --login VOTRE_EMAIL")
            self.running = False

        elif msg_type == "start":
            log.info(f"Ordre START recu: {data.get('message', '')}")
            await self.start_shabbat(
                shabbat_times=data.get("shabbat_times"),
                duration_hours=data.get("duration_hours"),
            )

        elif msg_type == "stop":
            log.info(f"Ordre STOP recu: {data.get('message', '')}")
            await self.stop_shabbat(data.get("message", "Ordre du VPS"))

        elif msg_type == "command":
            await self.run_command(data.get("device_id"), data.get("command"))

        elif msg_type == "scan":
            # Scan en tache de fond pour ne pas bloquer la reception WS
            asyncio.create_task(self.run_scan(float(data.get("timeout", 8))))

        elif msg_type == "status_request":
            await self.send_status()

        elif msg_type == "notification":
            log.info(f"Notification VPS: {data.get('message', '')}")

        elif msg_type == "pong":
            pass

    # ── Boucles ──

    async def _ping_loop(self):
        while self.ws is not None and not self.ws.closed:
            await asyncio.sleep(PING_INTERVAL)
            await self.send({"type": "ping"})

    async def _status_loop(self):
        while self.ws is not None and not self.ws.closed:
            await asyncio.sleep(STATUS_INTERVAL)
            if self.shabbat_active:
                await self.send_status()

    async def _connect_once(self, session: aiohttp.ClientSession):
        """Une connexion WS complete : auth + boucle de reception."""
        url = ws_url_from(self.vps_url)
        log.info(f"Connexion au VPS: {url}")

        async with session.ws_connect(url, heartbeat=55) as ws:
            self.ws = ws
            await ws.send_json({
                "type": "auth",
                "token": self.token,
                "role": "hub",
                "hub_info": {
                    "version": AGENT_VERSION,
                    "platform": platform.system().lower(),
                    "device_count": len(db_list_devices()),
                },
            })

            ping_task = asyncio.create_task(self._ping_loop())
            status_task = asyncio.create_task(self._status_loop())
            try:
                async for msg in ws:
                    if msg.type == aiohttp.WSMsgType.TEXT:
                        try:
                            data = json.loads(msg.data)
                        except Exception:
                            continue
                        await self.handle_message(data)
                    elif msg.type in (aiohttp.WSMsgType.ERROR,
                                      aiohttp.WSMsgType.CLOSED):
                        break
            finally:
                ping_task.cancel()
                status_task.cancel()
                self.ws = None

    async def run(self):
        """Boucle principale : connexion au VPS avec reconnexion infinie.

        IMPORTANT : une coupure VPS n'arrete PAS le monitoring local.
        Les controleurs continuent de tourner pendant la reconnexion —
        le Shabbat ne depend pas du cloud une fois demarre.
        """
        attempt = 0
        async with aiohttp.ClientSession() as session:
            while self.running:
                try:
                    await self._connect_once(session)
                    attempt = 0  # connexion reussie -> reset backoff
                    if not self.running:
                        break
                    log.warning("Connexion VPS fermee")
                except Exception as e:
                    log.warning(f"Connexion VPS echouee: {e}")

                if not self.running:
                    break
                delay = RECONNECT_DELAYS[min(attempt, len(RECONNECT_DELAYS) - 1)]
                attempt += 1
                log.info(f"Reconnexion dans {delay}s... "
                         f"(monitoring local: {'ACTIF' if self.shabbat_active else 'inactif'})")
                await asyncio.sleep(delay)

        await self.stop_shabbat("Arret de l'agent")


# ── Login ─────────────────────────────────────────

async def do_login(vps_url, email, password):
    """Login sur le VPS, retourne le token JWT."""
    api = vps_url.rstrip("/") + "/api/auth/login"
    async with aiohttp.ClientSession() as session:
        async with session.post(api, json={"email": email, "password": password}) as resp:
            data = await resp.json()
            if resp.status != 200 or "token" not in data:
                raise RuntimeError(data.get("error", f"HTTP {resp.status}"))
            return data["token"]


# ── Point d'entree embarque (app Android / Chaquopy) ──

def run_embedded(vps_url, token):
    """Appele par le Foreground Service Android via Chaquopy."""
    db_migrate()
    agent = HubAgent(vps_url, token)
    asyncio.run(agent.run())


# ── CLI ───────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="ShabbatTV Hub Agent")
    parser.add_argument("--url", help="URL du VPS (defaut: config ou env)")
    parser.add_argument("--token", help="Token JWT (defaut: config ou env)")
    parser.add_argument("--login", metavar="EMAIL",
                        help="Se connecter au VPS et sauvegarder le token")
    parser.add_argument("--devices", action="store_true",
                        help="Lister les appareils locaux")
    args = parser.parse_args()

    db_migrate()

    if args.devices:
        devices = db_list_devices(enabled_only=False)
        if not devices:
            print("Aucun appareil appaire. Lancez: python pair.py")
            return
        for d in devices:
            state = "actif" if d.get("enabled") else "desactive"
            protos = ", ".join(d["credentials"].keys()) or "aucun credential"
            print(f"  #{d['id']}  {d['name']}  [{d.get('type', 'appletv')}]  "
                  f"({d['address']})  [{protos}]  {state}")
        return

    config_url, config_token = load_config()
    vps_url = args.url or config_url

    if args.login:
        import getpass
        password = getpass.getpass(f"Mot de passe pour {args.login}: ")
        try:
            token = asyncio.run(do_login(vps_url, args.login, password))
        except Exception as e:
            print(f"Login echoue: {e}")
            sys.exit(1)
        save_config(vps_url, token)
        print("Login OK — lancez maintenant: python hub_agent.py")
        return

    token = args.token or config_token
    if not token:
        print("Aucun token configure.")
        print(f"  1. python hub_agent.py --login VOTRE_EMAIL")
        print(f"  2. ou: python hub_agent.py --url URL --token TOKEN")
        sys.exit(1)

    agent = HubAgent(vps_url, token)
    try:
        asyncio.run(agent.run())
    except KeyboardInterrupt:
        log.info("Arret demande (Ctrl+C)")


if __name__ == "__main__":
    main()
