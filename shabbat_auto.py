#!/usr/bin/env python3
"""
Shabbat TV - Auto-continue universel pour Apple TV
====================================================
Detecte quand la lecture s'arrete (fin d'episode, pub, Netflix,
Disney+, Prime Video, YouTube, Apple TV+, Molotov, etc.)
et relance automatiquement — sans toucher la telecommande.

Fonctionne avec TOUTE app de streaming. Le script agit au niveau
du protocole Apple TV (play/pause/select), pas au niveau app.

v1.1 : Push Updater (event-driven, plus de polling)
     + Reconnexion robuste avec backoff
     + Notifications via ntfy.sh
     + Activation auto basee sur horaires Shabbat

Usage:
    python shabbat_auto.py --start --device 1
    python shabbat_auto.py --start --device 1 --duration 14
    python shabbat_auto.py --start --device 1 --auto-shabbat
    python shabbat_auto.py --list
"""

import argparse
import asyncio
import json
import logging
import sqlite3
import sys
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path

try:
    import pyatv
    from pyatv.const import DeviceState, Protocol
    from pyatv.interface import DeviceListener, PushUpdater, Playing
except ImportError:
    print("Erreur: pyatv n'est pas installe.")
    print("  pip install pyatv")
    sys.exit(1)

SCRIPT_DIR = Path(__file__).parent
DB_PATH = SCRIPT_DIR / "shabbat.db"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
    stream=sys.stderr,
)
for handler in logging.root.handlers:
    if hasattr(handler, "stream"):
        handler.stream = sys.stderr
log = logging.getLogger("shabbat")

STOPPED_STATES = {DeviceState.Paused, DeviceState.Stopped, DeviceState.Idle}
PLAYING_STATES = {DeviceState.Playing, DeviceState.Loading, DeviceState.Seeking}

# Timing
REACT_DELAY = 15        # Secondes avant de reagir a un arret
FALLBACK_INTERVAL = 25  # Minutes entre fallback selects
HEARTBEAT_INTERVAL = 30  # Secondes entre heartbeats
RECONNECT_DELAYS = [5, 10, 20, 30, 60]  # Backoff en secondes


# ── Notifications ─────────────────────────────────

class Notifier:
    """Envoie des notifications via ntfy.sh (gratuit, sans compte)."""

    def __init__(self, topic=None):
        self.topic = topic  # ex: "shabbat-tv-famille-cohen"
        self.enabled = bool(topic)

    async def send(self, title, message, priority="default", tags=None):
        if not self.enabled:
            return
        try:
            url = f"https://ntfy.sh/{self.topic}"
            headers = {
                "Title": title,
                "Priority": priority,
            }
            if tags:
                headers["Tags"] = tags
            data = message.encode("utf-8")
            req = urllib.request.Request(url, data=data, headers=headers, method="POST")
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, lambda: urllib.request.urlopen(req, timeout=5))
            log.info(f"Notification envoyee: {title}")
        except Exception as e:
            log.warning(f"Notification echouee: {e}")

    async def notify_connected(self, device_name):
        await self.send(
            "Shabbat TV - Connecte",
            f"{device_name} est connecte et surveille.",
            tags="white_check_mark",
        )

    async def notify_disconnected(self, device_name):
        await self.send(
            "Shabbat TV - Deconnecte",
            f"{device_name} deconnecte. Tentative de reconnexion...",
            priority="high",
            tags="warning",
        )

    async def notify_action(self, device_name, action, count):
        await self.send(
            "Shabbat TV - Action",
            f"{device_name}: {action} (#{count})",
            tags="tv",
        )

    async def notify_finished(self, device_name, press_count, reconnect_count, duration_h):
        await self.send(
            "Shabbat TV - Termine",
            f"{device_name}: {press_count} relances, {reconnect_count} reconnexions en {duration_h:.1f}h.",
            tags="tada",
        )

    async def notify_error(self, device_name, error):
        await self.send(
            "Shabbat TV - Erreur",
            f"{device_name}: {error}",
            priority="high",
            tags="x",
        )


# ── DB ────────────────────────────────────────────

def db_get_device(device_id):
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    row = conn.execute("SELECT * FROM devices WHERE id=?", (device_id,)).fetchone()
    conn.close()
    if not row:
        return None
    dev = dict(row)
    dev["credentials"] = json.loads(dev["credentials"])
    return dev


def db_list_devices():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT * FROM devices WHERE enabled=1 ORDER BY id").fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["credentials"] = json.loads(d["credentials"])
        result.append(d)
    return result


def db_update_last_seen(identifier, address=None):
    try:
        conn = sqlite3.connect(str(DB_PATH))
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        if address:
            conn.execute("UPDATE devices SET last_seen=?, address=? WHERE identifier=?",
                          (now, address, identifier))
        else:
            conn.execute("UPDATE devices SET last_seen=? WHERE identifier=?", (now, identifier))
        conn.commit()
        conn.close()
    except Exception:
        pass


def db_get_ntfy_topic():
    """Lit le topic ntfy depuis la DB (table settings)."""
    try:
        conn = sqlite3.connect(str(DB_PATH))
        conn.execute("""CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY, value TEXT
        )""")
        conn.commit()
        row = conn.execute("SELECT value FROM settings WHERE key='ntfy_topic'").fetchone()
        conn.close()
        return row[0] if row else None
    except Exception:
        return None


# ── Horaires Shabbat ──────────────────────────────

async def fetch_shabbat_times(geonameid="2988507"):
    """Recupere les horaires Shabbat via Hebcal. Default: Paris."""
    try:
        url = f"https://www.hebcal.com/shabbat?cfg=json&geonameid={geonameid}&M=on"
        loop = asyncio.get_running_loop()
        response = await loop.run_in_executor(None, lambda: urllib.request.urlopen(url, timeout=10))
        data = json.loads(response.read().decode())
        result = {"candle_lighting": None, "havdalah": None, "parasha": None}
        for item in data.get("items", []):
            cat = item.get("category", "")
            if cat == "candles":
                result["candle_lighting"] = item.get("date", "")
            elif cat == "havdalah":
                result["havdalah"] = item.get("date", "")
            elif cat == "parashat":
                result["parasha"] = item.get("title", "")
        return result
    except Exception as e:
        log.warning(f"Impossible de recuperer les horaires Shabbat: {e}")
        return None


def parse_shabbat_time(iso_str):
    """Parse un datetime ISO avec timezone."""
    if not iso_str:
        return None
    try:
        return datetime.fromisoformat(iso_str)
    except Exception:
        return None


# ── Connexion Apple TV ────────────────────────────

async def find_apple_tv(device):
    """Trouve l'Apple TV avec scan rapide puis large."""
    identifier = device["identifier"]
    address = device["address"]
    name = device["name"]
    credentials = device["credentials"]
    loop = asyncio.get_running_loop()

    # Tentative 1: scan par identifiant (rapide, ~3s)
    try:
        atvs = await pyatv.scan(loop, identifier=identifier, timeout=5)
        if atvs:
            atv = atvs[0]
            for proto_name, creds in credentials.items():
                atv.set_credentials(Protocol[proto_name], creds)
            db_update_last_seen(identifier, str(atv.address))
            log.info(f"Trouve par identifiant: {atv.name} ({atv.address})")
            return atv
    except Exception:
        pass

    # Tentative 2: scan large, match par nom/IP/identifiant
    try:
        atvs = await pyatv.scan(loop, timeout=10)
        for a in atvs:
            if str(a.identifier) == identifier or str(a.address) == address or name.lower() in str(a.name).lower():
                for proto_name, creds in credentials.items():
                    a.set_credentials(Protocol[proto_name], creds)
                db_update_last_seen(identifier, str(a.address))
                log.info(f"Trouve par scan large: {a.name} ({a.address})")
                return a
    except Exception:
        pass

    return None


# ── Controleur principal (event-driven) ───────────

class ShabbatController(DeviceListener):
    """
    Controleur event-driven:
    - PushUpdater pour recevoir les changements d'etat en temps reel
    - DeviceListener pour detecter les pertes de connexion
    - Heartbeat pour verifier que la connexion est vivante
    - Reconnexion automatique avec backoff
    """

    def __init__(self, device, notifier, duration_hours, fallback_minutes):
        self.device = device
        self.notifier = notifier
        self.duration_hours = duration_hours
        self.fallback_minutes = fallback_minutes

        # Etat
        self.apple_tv = None
        self.running = False
        self.press_count = 0
        self.reconnect_count = 0
        self.was_playing = False
        self.stopped_since = None
        self.last_fallback = datetime.now()
        self.last_state = None
        self.connection_lost_event = asyncio.Event()

    # ── DeviceListener callbacks ──

    def connection_closed(self):
        log.warning("Connexion fermee par l'Apple TV")
        self.apple_tv = None
        self.connection_lost_event.set()

    def connection_lost(self, exception):
        log.warning(f"Connexion perdue: {exception}")
        self.apple_tv = None
        self.connection_lost_event.set()

    # ── PushUpdater callback ──

    def state_updated(self, updater, playstatus: Playing):
        """Appele par pyatv quand l'etat de lecture change."""
        state = playstatus.device_state
        title = playstatus.title or ""
        self.last_state = state

        if state in PLAYING_STATES:
            if self.stopped_since is not None:
                log.info(f"Lecture reprise: {state.name} - {title}")
                self.stopped_since = None
            self.was_playing = True

        elif state in STOPPED_STATES and self.was_playing:
            if self.stopped_since is None:
                self.stopped_since = datetime.now()
                log.info(f"Arret detecte: {state.name} (attente {REACT_DELAY}s...)")
                # Planifier la reaction
                asyncio.get_running_loop().create_task(self._delayed_react())

    async def _delayed_react(self):
        """Attend REACT_DELAY puis relance si toujours arrete."""
        await asyncio.sleep(REACT_DELAY)

        if self.stopped_since is None:
            return  # Deja repris entre temps
        if self.apple_tv is None:
            return  # Deconnecte

        self.press_count += 1
        log.info(f"[#{self.press_count}] Arret confirme -> envoi Play")

        try:
            remote = self.apple_tv.remote_control
            await remote.play()
            await asyncio.sleep(5)

            # Verifier si Play a suffi
            status = await self.apple_tv.metadata.playing()
            if status.device_state in STOPPED_STATES:
                log.info(f"  Toujours arrete -> envoi Select")
                await remote.select()
                await asyncio.sleep(2)
            else:
                log.info(f"  Lecture reprise ({status.device_state.name})")

            self.stopped_since = None
            self.last_fallback = datetime.now()

            await self.notifier.notify_action(
                self.device["name"], "Relance auto", self.press_count
            )
        except Exception as e:
            log.warning(f"Commande echouee: {e}")
            self.stopped_since = None

    # ── Connexion ──

    async def connect(self):
        """Connecte a l'Apple TV et demarre le push updater."""
        atv = await find_apple_tv(self.device)
        if not atv:
            return False

        try:
            self.apple_tv = await pyatv.connect(atv, asyncio.get_running_loop())
        except Exception as e:
            log.warning(f"Connexion echouee: {e}")
            return False

        # Enregistrer le listener de connexion
        self.apple_tv.listener = self

        # Demarrer le push updater
        self.apple_tv.push_updater.listener = self
        self.apple_tv.push_updater.start()

        self.reconnect_count += 1
        self.connection_lost_event.clear()
        log.info(f"Connecte a {self.device['name']} (connexion #{self.reconnect_count})")
        return True

    async def disconnect(self):
        if self.apple_tv:
            try:
                self.apple_tv.push_updater.stop()
            except Exception:
                pass
            try:
                self.apple_tv.close()
            except Exception:
                pass
            self.apple_tv = None

    async def reconnect_with_backoff(self):
        """Reconnexion avec backoff exponentiel."""
        for i, delay in enumerate(RECONNECT_DELAYS):
            log.info(f"Reconnexion dans {delay}s (tentative {i + 1}/{len(RECONNECT_DELAYS)})...")
            await asyncio.sleep(delay)

            if await self.connect():
                await self.notifier.notify_connected(self.device["name"])
                return True

        # Toutes les tentatives epuisees, on continue d'essayer
        log.warning("Toutes les tentatives echouees, retry toutes les 60s...")
        while self.running:
            await asyncio.sleep(60)
            if await self.connect():
                await self.notifier.notify_connected(self.device["name"])
                return True
        return False

    # ── Heartbeat ──

    async def heartbeat_loop(self):
        """Verifie periodiquement que la connexion est vivante."""
        while self.running:
            await asyncio.sleep(HEARTBEAT_INTERVAL)
            if not self.running:
                break
            if self.apple_tv is None:
                continue
            try:
                await self.apple_tv.metadata.playing()
            except Exception:
                log.warning("Heartbeat echoue")
                self.connection_lost_event.set()

    # ── Fallback ──

    async def fallback_loop(self):
        """Envoie un Select periodique en cas de doute."""
        while self.running:
            await asyncio.sleep(60)
            if not self.running:
                break
            if self.apple_tv is None:
                continue

            elapsed = (datetime.now() - self.last_fallback).total_seconds()
            if elapsed >= self.fallback_minutes * 60:
                try:
                    self.press_count += 1
                    log.info(f"[#{self.press_count}] Fallback Play+Select ({self.fallback_minutes}min)")
                    await self.apple_tv.remote_control.play()
                    await asyncio.sleep(2)
                    await self.apple_tv.remote_control.select()
                    self.last_fallback = datetime.now()
                except Exception:
                    log.warning("Fallback echoue")

    # ── Boucle principale ──

    async def run(self, end_time):
        """Boucle principale event-driven."""
        self.running = True

        log.info("=== Shabbat Auto-Continue v1.1 ===")
        log.info(f"  Appareil: {self.device['name']} (#{self.device['id']})")
        log.info(f"  IP: {self.device['address']}")
        log.info(f"  Mode: Push Updater (event-driven)")
        log.info(f"  Fallback: {self.fallback_minutes}min | React: {REACT_DELAY}s")
        log.info(f"  Fin prevue: {end_time.strftime('%H:%M:%S')}")
        log.info(f"  Notifications: {'ON' if self.notifier.enabled else 'OFF'}")

        # Premiere connexion
        if not await self.connect():
            log.warning("Premiere connexion echouee, tentative de reconnexion...")
            await self.notifier.notify_error(self.device["name"], "Connexion initiale echouee")
            if not await self.reconnect_with_backoff():
                log.error("Impossible de se connecter. Abandon.")
                return
        await self.notifier.notify_connected(self.device["name"])

        # Lancer les taches de fond
        heartbeat = asyncio.create_task(self.heartbeat_loop())
        fallback = asyncio.create_task(self.fallback_loop())

        try:
            while datetime.now() < end_time and self.running:
                # Attendre soit la fin, soit une deconnexion
                remaining = (end_time - datetime.now()).total_seconds()
                if remaining <= 0:
                    break

                try:
                    await asyncio.wait_for(
                        self.connection_lost_event.wait(),
                        timeout=min(remaining, 60),
                    )
                except asyncio.TimeoutError:
                    continue

                if not self.running:
                    break

                # Connexion perdue — reconnexion
                self.connection_lost_event.clear()
                await self.notifier.notify_disconnected(self.device["name"])
                await self.disconnect()

                if datetime.now() >= end_time:
                    break

                if not await self.reconnect_with_backoff():
                    break

        finally:
            self.running = False
            heartbeat.cancel()
            fallback.cancel()
            await self.disconnect()

        duration_h = (datetime.now() - (end_time - timedelta(hours=self.duration_hours))).total_seconds() / 3600
        log.info(f"Termine. {self.press_count} relances, {self.reconnect_count} reconnexions.")
        await self.notifier.notify_finished(
            self.device["name"], self.press_count, self.reconnect_count, duration_h
        )


# ── Mode auto-Shabbat ────────────────────────────

async def run_auto_shabbat(device, notifier, fallback_minutes):
    """Attend l'entree de Shabbat, lance le controleur, s'arrete a havdalah."""
    log.info("=== Mode Auto-Shabbat ===")
    log.info(f"  Appareil: {device['name']}")
    log.info("  Recuperation des horaires...")

    shabbat = await fetch_shabbat_times()
    if not shabbat or not shabbat.get("candle_lighting"):
        log.error("Impossible de recuperer les horaires Shabbat.")
        await notifier.notify_error(device["name"], "Horaires Shabbat indisponibles")
        return

    candle = parse_shabbat_time(shabbat["candle_lighting"])
    havdalah = parse_shabbat_time(shabbat["havdalah"])
    parasha = shabbat.get("parasha", "?")

    if not candle or not havdalah:
        log.error("Horaires invalides.")
        return

    now = datetime.now(candle.tzinfo) if candle.tzinfo else datetime.now()

    log.info(f"  Parasha: {parasha}")
    log.info(f"  Bougies: {candle.strftime('%A %d/%m %H:%M')}")
    log.info(f"  Havdalah: {havdalah.strftime('%A %d/%m %H:%M')}")

    # Deja pendant Shabbat ?
    if candle <= now <= havdalah:
        log.info("  Shabbat est en cours! Demarrage immediat.")
        start_time = now
    elif now < candle:
        wait = (candle - now).total_seconds()
        # Demarrer 5 minutes avant les bougies
        wait = max(0, wait - 300)
        if wait > 0:
            log.info(f"  Attente de {wait / 60:.0f} minutes avant les bougies...")
            await notifier.send(
                "Shabbat TV - Attente",
                f"{device['name']}: demarrage dans {wait / 60:.0f} min (bougies a {candle.strftime('%H:%M')})",
                tags="candle",
            )
            await asyncio.sleep(wait)
        start_time = datetime.now(candle.tzinfo) if candle.tzinfo else datetime.now()
    else:
        log.info("  Shabbat est deja termine. Rien a faire.")
        return

    # Lancer le controleur jusqu'a havdalah
    duration_hours = (havdalah - start_time).total_seconds() / 3600
    # Ajouter 30 min de marge apres havdalah
    duration_hours += 0.5
    log.info(f"  Duree: {duration_hours:.1f}h")

    controller = ShabbatController(device, notifier, duration_hours, fallback_minutes)
    end_time = start_time + timedelta(hours=duration_hours)
    await controller.run(end_time)


# ── Commandes ─────────────────────────────────────

def cmd_list():
    devices = db_list_devices()
    if not devices:
        print("Aucun appareil appaire. Lancez: python pair.py")
        return
    print(f"\n{len(devices)} appareil(s) disponible(s):\n")
    for dev in devices:
        protos = ", ".join(dev["credentials"].keys())
        print(f"  #{dev['id']}  {dev['name']}  ({dev['address']})  [{protos}]")
    print(f"\nCommandes:")
    print(f"  python shabbat_auto.py --start --device <ID>")
    print(f"  python shabbat_auto.py --start --device <ID> --auto-shabbat")


def main():
    parser = argparse.ArgumentParser(description="Shabbat TV - Auto-continue Apple TV")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--start", action="store_true", help="Demarrer le mode Shabbat")
    group.add_argument("--list", action="store_true", help="Lister les appareils")

    parser.add_argument("--device", type=int, help="ID de l'appareil")
    parser.add_argument("--interval", type=int, default=25, help="Intervalle fallback en minutes (defaut: 25)")
    parser.add_argument("--duration", type=float, default=14, help="Duree en heures (defaut: 14)")
    parser.add_argument("--auto-shabbat", action="store_true",
                        help="Mode automatique: attend l'entree de Shabbat, s'arrete a havdalah")
    parser.add_argument("--ntfy", type=str, default=None,
                        help="Topic ntfy.sh pour les notifications (ex: shabbat-tv-cohen)")

    args = parser.parse_args()

    if args.list:
        cmd_list()
        return

    if args.start:
        if not args.device:
            print("Erreur: --device requis. Utilisez --list pour voir les appareils.")
            sys.exit(1)

        device = db_get_device(args.device)
        if not device:
            print(f"Erreur: appareil #{args.device} introuvable.")
            sys.exit(1)
        if not device["credentials"]:
            print(f"Erreur: appareil #{args.device} n'a pas de credentials. Lancez pair.py")
            sys.exit(1)

        # Notifications
        ntfy_topic = args.ntfy or db_get_ntfy_topic()
        notifier = Notifier(ntfy_topic)

        if args.auto_shabbat:
            asyncio.run(run_auto_shabbat(device, notifier, args.interval))
        else:
            controller = ShabbatController(device, notifier, args.duration, args.interval)
            end_time = datetime.now() + timedelta(hours=args.duration)
            asyncio.run(controller.run(end_time))


if __name__ == "__main__":
    main()
