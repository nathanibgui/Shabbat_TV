#!/usr/bin/env python3
"""
Shabbat TV - Dashboard Server v4 (dynamique)
==============================================
- Appareils lus depuis la DB SQLite (pair.py)
- Plus aucun hardcode de TV
- REST API + WebSocket
- Watchdog auto-restart pendant Shabbat
- Horaires Shabbat via Hebcal
"""
import asyncio
import json
import os
import re
import sqlite3
import subprocess
import sys
import time
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path

from aiohttp import web

try:
    import pyatv
    from pyatv.const import DeviceState, Protocol
    PYATV_AVAILABLE = True
except ImportError:
    PYATV_AVAILABLE = False
    print("Warning: pyatv non installe — mode API uniquement (pas de controle TV)")

SCRIPT_DIR = Path(__file__).parent
PYTHON_EXE = sys.executable
DB_PATH = SCRIPT_DIR / "shabbat.db"
LOG_DIR = SCRIPT_DIR / "logs"

ws_clients = set()
events_timeline = []
MAX_EVENTS = 200
server_start_time = time.time()
shabbat_times_cache = {}
watchdog_enabled = True


# ── DB ────────────────────────────────────────────

def init_db():
    LOG_DIR.mkdir(exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    c = conn.cursor()
    # Table devices (creee par pair.py, on s'assure qu'elle existe)
    c.execute("""CREATE TABLE IF NOT EXISTS devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        identifier TEXT NOT NULL UNIQUE,
        credentials TEXT NOT NULL DEFAULT '{}',
        paired_at TEXT NOT NULL,
        last_seen TEXT,
        enabled INTEGER NOT NULL DEFAULT 1
    )""")
    # Table events
    c.execute("""CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        device_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        message TEXT NOT NULL
    )""")
    # Table shabbat_log
    c.execute("""CREATE TABLE IF NOT EXISTS shabbat_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE,
        candle_lighting TEXT,
        havdalah TEXT,
        parasha TEXT
    )""")
    # Table notification_prefs (stockage local Hub — backup des prefs du téléphone)
    c.execute("""CREATE TABLE IF NOT EXISTS notification_prefs (
        id INTEGER PRIMARY KEY DEFAULT 1,
        shabbat_start INTEGER NOT NULL DEFAULT 1,
        shabbat_end INTEGER NOT NULL DEFAULT 1,
        candle_reminder INTEGER NOT NULL DEFAULT 1,
        candle_reminder_minutes INTEGER NOT NULL DEFAULT 18,
        relaunch_alert INTEGER NOT NULL DEFAULT 1,
        error_alert INTEGER NOT NULL DEFAULT 1
    )""")
    # Seed default prefs if empty
    c.execute("INSERT OR IGNORE INTO notification_prefs (id) VALUES (1)")
    conn.commit()
    conn.close()


def db_get_devices():
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


def db_get_device(device_id):
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    row = conn.execute("SELECT * FROM devices WHERE id=?", (device_id,)).fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    d["credentials"] = json.loads(d["credentials"])
    return d


def db_add_event(device_id, event_type, message):
    try:
        conn = sqlite3.connect(str(DB_PATH))
        conn.execute("INSERT INTO events (timestamp, device_id, type, message) VALUES (?, ?, ?, ?)",
                      (datetime.now().strftime("%Y-%m-%d %H:%M:%S"), device_id, event_type, message))
        conn.commit()
        conn.close()
    except Exception:
        pass


def db_get_events(limit=100, device_id=None):
    try:
        conn = sqlite3.connect(str(DB_PATH))
        conn.row_factory = sqlite3.Row
        if device_id:
            rows = conn.execute("SELECT * FROM events WHERE device_id=? ORDER BY id DESC LIMIT ?",
                                 (device_id, limit)).fetchall()
        else:
            rows = conn.execute("SELECT * FROM events ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception:
        return []


def db_get_stats():
    try:
        conn = sqlite3.connect(str(DB_PATH))
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT type, COUNT(*) as cnt FROM events GROUP BY type")
        by_type = {r["type"]: r["cnt"] for r in c.fetchall()}
        c.execute("""SELECT date(timestamp) as day, device_id, type, COUNT(*) as cnt
                     FROM events WHERE timestamp >= date('now', '-7 days')
                     GROUP BY day, device_id, type ORDER BY day""")
        daily = [dict(r) for r in c.fetchall()]
        c.execute("SELECT device_id, type, COUNT(*) as cnt FROM events GROUP BY device_id, type")
        by_device = [dict(r) for r in c.fetchall()]
        conn.close()
        return {"by_type": by_type, "daily": daily, "by_device": by_device}
    except Exception:
        return {"by_type": {}, "daily": [], "by_device": []}


def db_save_shabbat(date_str, candle, havdalah, parasha):
    try:
        conn = sqlite3.connect(str(DB_PATH))
        conn.execute("""INSERT OR REPLACE INTO shabbat_log (date, candle_lighting, havdalah, parasha)
                        VALUES (?, ?, ?, ?)""", (date_str, candle, havdalah, parasha))
        conn.commit()
        conn.close()
    except Exception:
        pass


def db_get_shabbat_history():
    try:
        conn = sqlite3.connect(str(DB_PATH))
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM shabbat_log ORDER BY date DESC LIMIT 20").fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception:
        return []


# ── Helpers ───────────────────────────────────────

def get_log_path(device_id):
    return LOG_DIR / f"device_{device_id}.log"


def get_pid_path(device_id):
    return LOG_DIR / f"device_{device_id}.pid"


def safe_decode(raw_bytes):
    if not raw_bytes:
        return ""
    if raw_bytes[:2] in (b"\xff\xfe", b"\xfe\xff"):
        return raw_bytes.decode("utf-16", errors="replace")
    return raw_bytes.decode("utf-8", errors="replace")


def read_log_file(path):
    if not path.exists():
        return ""
    try:
        raw = path.read_bytes()
        if not raw:
            return ""
        try:
            return raw.decode("utf-8")
        except UnicodeDecodeError:
            return raw.decode("latin-1", errors="replace")
    except Exception:
        return ""


# ── Horaires Shabbat ──────────────────────────────

async def fetch_shabbat_times():
    global shabbat_times_cache
    today = datetime.now().strftime("%Y-%m-%d")
    if shabbat_times_cache.get("date") == today and shabbat_times_cache.get("data"):
        return shabbat_times_cache["data"]
    try:
        url = "https://www.hebcal.com/shabbat?cfg=json&geonameid=2988507&M=on"
        loop = asyncio.get_running_loop()
        response = await loop.run_in_executor(None, lambda: urllib.request.urlopen(url, timeout=10))
        data = json.loads(response.read().decode())
        result = {"candle_lighting": None, "havdalah": None, "parasha": None, "date": None}
        for item in data.get("items", []):
            cat = item.get("category", "")
            if cat == "candles":
                result["candle_lighting"] = item.get("date", "")
                result["date"] = result["candle_lighting"][:10]
            elif cat == "havdalah":
                result["havdalah"] = item.get("date", "")
            elif cat == "parashat":
                result["parasha"] = item.get("title", "")
        shabbat_times_cache = {"date": today, "data": result}
        if result["date"]:
            db_save_shabbat(result["date"], result["candle_lighting"], result["havdalah"], result["parasha"])
        return result
    except Exception as e:
        return {"candle_lighting": None, "havdalah": None, "parasha": None, "error": str(e)}


def is_shabbat_now(shabbat_data):
    if not shabbat_data or not shabbat_data.get("candle_lighting"):
        return False
    try:
        candle = datetime.fromisoformat(shabbat_data["candle_lighting"])
        havdalah_str = shabbat_data.get("havdalah")
        havdalah = datetime.fromisoformat(havdalah_str) if havdalah_str else candle + timedelta(hours=25)
        now = datetime.now(candle.tzinfo) if candle.tzinfo else datetime.now()
        return candle <= now <= havdalah
    except Exception:
        return False


# ── Apple TV connexion ────────────────────────────

async def get_atv_connection(device):
    credentials = device["credentials"]
    if not credentials:
        return None
    loop = asyncio.get_running_loop()
    identifier = device["identifier"]
    address = device["address"]
    name = device["name"]

    # Scan rapide par identifiant
    try:
        atvs = await pyatv.scan(loop, identifier=identifier, timeout=5)
        if atvs:
            atv = atvs[0]
            for proto_name, creds in credentials.items():
                atv.set_credentials(Protocol[proto_name], creds)
            apple_tv = await pyatv.connect(atv, loop)
            return apple_tv
    except Exception:
        pass

    # Scan large
    try:
        atvs = await pyatv.scan(loop, timeout=10)
        for a in atvs:
            if str(a.identifier) == identifier or str(a.address) == address or name.lower() in str(a.name).lower():
                for proto_name, creds in credentials.items():
                    a.set_credentials(Protocol[proto_name], creds)
                apple_tv = await pyatv.connect(a, loop)
                return apple_tv
    except Exception:
        pass

    return None


# ── Script management ─────────────────────────────

_NO_WINDOW = subprocess.CREATE_NO_WINDOW


def is_script_running(device_id):
    pid_path = get_pid_path(device_id)
    if pid_path.exists():
        try:
            pid = int(pid_path.read_text().strip())
            result = subprocess.run(["tasklist", "/FI", f"PID eq {pid}", "/NH"],
                                     capture_output=True, timeout=10,
                                     creationflags=_NO_WINDOW)
            if "python" in safe_decode(result.stdout).lower():
                return True, pid
        except Exception:
            pass
    # Fallback: chercher le process par commandline
    try:
        result = subprocess.run(
            ["powershell", "-Command",
             f"Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | "
             f"Where-Object {{ $_.CommandLine -like '*--device {device_id}*' }} | "
             f"Select-Object ProcessId -ExpandProperty ProcessId"],
            capture_output=True, timeout=10,
            creationflags=_NO_WINDOW)
        stdout = safe_decode(result.stdout)
        if stdout.strip():
            pid = int(stdout.strip().split("\n")[0])
            pid_path.write_text(str(pid))
            return True, pid
    except Exception:
        pass
    return False, None


def start_script(device_id, auto_shabbat=False):
    log_path = get_log_path(device_id)
    cmd = [PYTHON_EXE, "-X", "utf8", "-u",
           str(SCRIPT_DIR / "shabbat_auto.py"),
           "--start", "--device", str(device_id)]
    if auto_shabbat:
        cmd.append("--auto-shabbat")
    # Ajouter le topic ntfy si configure
    ntfy_topic = _get_setting("ntfy_topic")
    if ntfy_topic:
        cmd.extend(["--ntfy", ntfy_topic])
    with open(str(log_path), "w", encoding="utf-8") as log_file:
        proc = subprocess.Popen(
            cmd, stdout=subprocess.DEVNULL, stderr=log_file,
            creationflags=subprocess.CREATE_NO_WINDOW,
        )
    get_pid_path(device_id).write_text(str(proc.pid))
    mode = "auto-shabbat" if auto_shabbat else "manuel"
    add_event(device_id, "script", f"Script demarre (PID {proc.pid}, mode: {mode})")
    db_add_event(device_id, "script", f"Script demarre (PID {proc.pid}, mode: {mode})")
    return proc.pid


def _get_setting(key):
    try:
        conn = sqlite3.connect(str(DB_PATH))
        conn.execute("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)")
        row = conn.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
        conn.close()
        return row[0] if row else None
    except Exception:
        return None


def stop_script(device_id):
    running, pid = is_script_running(device_id)
    if running and pid:
        try:
            subprocess.run(["taskkill", "/PID", str(pid), "/F"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10,
                            creationflags=_NO_WINDOW)
            get_pid_path(device_id).unlink(missing_ok=True)
            add_event(device_id, "script", f"Script arrete (PID {pid})")
            db_add_event(device_id, "script", f"Script arrete (PID {pid})")
            return True
        except Exception:
            pass
    return False


# ── Watchdog ──────────────────────────────────────

async def watchdog_loop():
    while True:
        try:
            if watchdog_enabled:
                shabbat = await fetch_shabbat_times()
                if is_shabbat_now(shabbat):
                    for device in db_get_devices():
                        if not device["credentials"]:
                            continue
                        running, _ = is_script_running(device["id"])
                        if not running:
                            add_event(device["id"], "watchdog", "Script mort - relance automatique")
                            db_add_event(device["id"], "watchdog", "Watchdog: relance automatique")
                            start_script(device["id"])
        except Exception:
            pass
        await asyncio.sleep(10)


# ── Events / WebSocket ────────────────────────────

def add_event(device_id, event_type, message):
    evt = {
        "timestamp": datetime.now().strftime("%H:%M:%S"),
        "device_id": device_id,
        "type": event_type,
        "message": message,
    }
    events_timeline.insert(0, evt)
    if len(events_timeline) > MAX_EVENTS:
        events_timeline.pop()
    try:
        asyncio.get_running_loop().create_task(broadcast_event(evt))
    except Exception:
        pass


async def broadcast_event(evt):
    global ws_clients
    if not ws_clients:
        return
    msg = json.dumps({"type": "event", "event": evt})
    dead = set()
    for ws in ws_clients:
        try:
            await ws.send_str(msg)
        except Exception:
            dead.add(ws)
    ws_clients -= dead


# ── API Routes ────────────────────────────────────

async def api_devices(request):
    """Liste tous les appareils avec leur statut."""
    devices = db_get_devices()
    result = []
    for dev in devices:
        running, pid = is_script_running(dev["id"])
        log_content = read_log_file(get_log_path(dev["id"]))
        lines = log_content.split("\n")
        select_count = sum(1 for l in lines if "select" in l.lower() and "envoi" in l.lower())
        error_count = sum(1 for l in lines if "error" in l.lower() or "traceback" in l.lower())
        last_log_time = None
        for line in reversed(lines):
            m = re.match(r"(\d{2}:\d{2}:\d{2})", line.strip())
            if m:
                last_log_time = m.group(1)
                break
        result.append({
            "id": dev["id"],
            "name": dev["name"],
            "address": dev["address"],
            "identifier": dev["identifier"],
            "has_credentials": bool(dev["credentials"]),
            "paired_at": dev["paired_at"],
            "last_seen": dev["last_seen"],
            "script_running": running,
            "pid": pid,
            "select_count": select_count,
            "error_count": error_count,
            "last_log_time": last_log_time,
        })
    return web.json_response(result)


async def api_scan(request):
    """Scan le reseau pour trouver les Apple TV."""
    try:
        loop = asyncio.get_running_loop()
        atvs = await pyatv.scan(loop, timeout=10)
        result = []
        for atv in atvs:
            protocols = [s.protocol.name for s in atv.services]
            result.append({
                "name": str(atv.name),
                "address": str(atv.address),
                "identifier": str(atv.identifier),
                "protocols": protocols,
            })
        return web.json_response(result)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


# ── Pairing API ───────────────────────────────────
# Stores active pairing sessions: {session_id: {pairing, atv, protocol, ...}}
_pairing_sessions = {}


async def api_pair_start(request):
    """Demarre l'appairage avec une Apple TV trouvee par scan.
    Body: {"identifier": "...", "name": "..."}
    Retourne un session_id pour envoyer le PIN ensuite.
    """
    data = await request.json()
    identifier = data.get("identifier")
    name = data.get("name", "")
    if not identifier:
        return web.json_response({"error": "identifier requis"}, status=400)

    loop = asyncio.get_running_loop()

    # Scan pour trouver l'appareil
    atvs = await pyatv.scan(loop, timeout=10)
    atv = None
    for a in atvs:
        if str(a.identifier) == identifier:
            atv = a
            break
    if not atv:
        return web.json_response({"error": "Appareil introuvable sur le reseau"}, status=404)

    # Tenter Companion d'abord, puis AirPlay
    protocols_to_try = [Protocol.Companion, Protocol.AirPlay]
    session_id = f"pair_{int(time.time())}_{identifier[:8]}"

    _pairing_sessions[session_id] = {
        "atv": atv,
        "identifier": identifier,
        "name": str(atv.name),
        "address": str(atv.address),
        "protocols_done": {},
        "protocols_to_try": protocols_to_try,
        "current_protocol_idx": 0,
        "pairing": None,
        "status": "starting",
    }

    # Start first protocol pairing
    result = await _start_next_protocol(session_id)
    return web.json_response(result)


async def _start_next_protocol(session_id):
    session = _pairing_sessions.get(session_id)
    if not session:
        return {"error": "Session introuvable", "session_id": session_id}

    idx = session["current_protocol_idx"]
    protocols = session["protocols_to_try"]
    atv = session["atv"]
    loop = asyncio.get_running_loop()

    while idx < len(protocols):
        protocol = protocols[idx]
        if protocol not in [s.protocol for s in atv.services]:
            idx += 1
            session["current_protocol_idx"] = idx
            continue

        try:
            pairing = await pyatv.pair(atv, protocol, loop)
            await pairing.begin()
            session["pairing"] = pairing
            session["status"] = "waiting_pin"
            session["current_protocol"] = protocol.name

            return {
                "session_id": session_id,
                "status": "waiting_pin",
                "protocol": protocol.name,
                "device_provides_pin": pairing.device_provides_pin,
                "name": session["name"],
            }
        except Exception as e:
            idx += 1
            session["current_protocol_idx"] = idx
            continue

    # All protocols tried without success
    session["status"] = "no_protocol"
    return {
        "session_id": session_id,
        "status": "no_protocol",
        "error": "Aucun protocole disponible pour l'appairage",
    }


async def api_pair_pin(request):
    """Envoie le PIN pour finaliser l'appairage.
    Body: {"session_id": "...", "pin": "1234"}
    """
    data = await request.json()
    session_id = data.get("session_id")
    pin = data.get("pin", "")

    session = _pairing_sessions.get(session_id)
    if not session:
        return web.json_response({"error": "Session expirée"}, status=404)

    pairing = session.get("pairing")
    if not pairing:
        return web.json_response({"error": "Pas d'appairage en cours"}, status=400)

    try:
        pairing.pin(int(pin))
        await pairing.finish()

        if pairing.has_paired:
            protocol_name = session["current_protocol"]
            creds = pairing.service.credentials
            session["protocols_done"][protocol_name] = creds
            await pairing.close()
            session["pairing"] = None

            # Try next protocol
            session["current_protocol_idx"] += 1
            next_result = await _start_next_protocol(session_id)

            if next_result.get("status") == "waiting_pin":
                # Another protocol needs pairing
                return web.json_response({
                    "status": "paired_partial",
                    "protocol_done": protocol_name,
                    "next_protocol": next_result["protocol"],
                    "session_id": session_id,
                })
            else:
                # All done — save to DB
                device_id = _save_paired_device(session)
                del _pairing_sessions[session_id]
                return web.json_response({
                    "status": "paired_complete",
                    "device_id": device_id,
                    "name": session["name"],
                    "protocols": list(session["protocols_done"].keys()),
                })
        else:
            await pairing.close()
            session["pairing"] = None
            return web.json_response({
                "status": "failed",
                "error": "Code PIN incorrect ou appairage refuse",
            })

    except Exception as e:
        try:
            await pairing.close()
        except Exception:
            pass
        session["pairing"] = None
        return web.json_response({"status": "error", "error": str(e)}, status=500)


def _save_paired_device(session):
    """Sauvegarde l'appareil appaire dans la DB."""
    conn = sqlite3.connect(str(DB_PATH))
    c = conn.cursor()
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    credentials = json.dumps(session["protocols_done"])
    c.execute("""INSERT INTO devices (name, address, identifier, credentials, paired_at, last_seen)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON CONFLICT(identifier) DO UPDATE SET
                    name=excluded.name, address=excluded.address,
                    credentials=excluded.credentials, last_seen=excluded.last_seen""",
              (session["name"], session["address"], session["identifier"], credentials, now, now))
    conn.commit()
    device_id = c.execute("SELECT id FROM devices WHERE identifier=?",
                           (session["identifier"],)).fetchone()[0]
    conn.close()
    return device_id


async def api_pair_cancel(request):
    """Annule un appairage en cours."""
    data = await request.json()
    session_id = data.get("session_id")
    session = _pairing_sessions.pop(session_id, None)
    if session and session.get("pairing"):
        try:
            await session["pairing"].close()
        except Exception:
            pass
    return web.json_response({"status": "cancelled"})


def _parse_device_id(request):
    raw = request.match_info["device_id"]
    try:
        return int(raw)
    except ValueError:
        return None


async def api_playback(request):
    device_id = _parse_device_id(request)
    if device_id is None:
        return web.json_response({"error": "ID invalide"}, status=400)
    device = db_get_device(device_id)
    if not device:
        return web.json_response({"error": "Appareil inconnu"}, status=404)
    apple_tv = await get_atv_connection(device)
    if not apple_tv:
        return web.json_response({"state": "disconnected"})
    try:
        status = await apple_tv.metadata.playing()
        result = {
            "state": status.device_state.name,
            "title": status.title,
            "position": status.position,
            "total_time": status.total_time,
            "media_type": status.media_type.name if status.media_type else None,
        }
    except Exception as e:
        result = {"state": "error", "error": str(e)}
    finally:
        apple_tv.close()
    return web.json_response(result)


async def api_command(request):
    device_id = _parse_device_id(request)
    if device_id is None:
        return web.json_response({"error": "ID invalide"}, status=400)
    device = db_get_device(device_id)
    if not device:
        return web.json_response({"error": "Appareil inconnu"}, status=404)
    data = await request.json()
    command = data.get("command")
    apple_tv = await get_atv_connection(device)
    if not apple_tv:
        return web.json_response({"error": "Connexion impossible"}, status=500)
    try:
        r = apple_tv.remote_control
        p = apple_tv.power
        cmd_map = {
            "select": r.select, "play_pause": r.play_pause,
            "up": r.up, "down": r.down, "left": r.left, "right": r.right,
            "menu": r.menu, "home": r.home, "turn_on": p.turn_on, "turn_off": p.turn_off,
        }
        if command == "launch_app":
            await apple_tv.apps.launch_app(data.get("app_id", ""))
        elif command in cmd_map:
            await cmd_map[command]()
        else:
            return web.json_response({"error": f"Commande inconnue: {command}"}, status=400)
        add_event(device_id, "command", command)
        db_add_event(device_id, "command", command)
        result = {"success": True, "command": command}
    except Exception as e:
        add_event(device_id, "error", f"Erreur '{command}': {str(e)[:80]}")
        result = {"success": False, "error": str(e)}
    finally:
        apple_tv.close()
    return web.json_response(result)


async def api_apps(request):
    device_id = _parse_device_id(request)
    if device_id is None:
        return web.json_response({"error": "ID invalide"}, status=400)
    device = db_get_device(device_id)
    if not device:
        return web.json_response({"error": "Appareil inconnu"}, status=404)
    apple_tv = await get_atv_connection(device)
    if not apple_tv:
        return web.json_response({"error": "Connexion impossible"}, status=500)
    try:
        app_list = await apple_tv.apps.app_list()
        result = [{"name": app.name, "id": app.identifier} for app in app_list]
    except Exception:
        result = []
    finally:
        apple_tv.close()
    return web.json_response(result)


async def api_script_start(request):
    device_id = _parse_device_id(request)
    if device_id is None:
        return web.json_response({"error": "ID invalide"}, status=400)
    device = db_get_device(device_id)
    if not device:
        return web.json_response({"error": "Appareil inconnu"}, status=404)
    running, _ = is_script_running(device_id)
    if running:
        return web.json_response({"error": "Deja en cours"}, status=400)
    data = {}
    if request.content_type == "application/json":
        data = await request.json()
    auto_shabbat = data.get("auto_shabbat", False)
    pid = start_script(device_id, auto_shabbat=auto_shabbat)
    return web.json_response({"success": True, "pid": pid, "auto_shabbat": auto_shabbat})


async def api_script_stop(request):
    device_id = _parse_device_id(request)
    if device_id is None:
        return web.json_response({"error": "ID invalide"}, status=400)
    return web.json_response({"success": stop_script(device_id)})


async def api_logs(request):
    device_id = _parse_device_id(request)
    if device_id is None:
        return web.json_response({"error": "ID invalide"}, status=400)
    content = read_log_file(get_log_path(device_id))
    return web.json_response({"logs": content})


async def api_events(request):
    return web.json_response({"events": events_timeline})


async def api_server_info(request):
    uptime = int(time.time() - server_start_time)
    h, m = uptime // 3600, (uptime % 3600) // 60
    return web.json_response({
        "uptime": f"{h}h{m:02d}",
        "uptime_seconds": uptime,
        "ws_clients": len(ws_clients),
        "start_time": datetime.fromtimestamp(server_start_time).strftime("%H:%M:%S"),
        "watchdog_enabled": watchdog_enabled,
        "device_count": len(db_get_devices()),
    })


async def api_shabbat(request):
    data = await fetch_shabbat_times()
    data["is_shabbat"] = is_shabbat_now(data)
    return web.json_response(data)


async def api_history(request):
    return web.json_response({
        "events": db_get_events(200),
        "stats": db_get_stats(),
        "shabbat_history": db_get_shabbat_history(),
    })


async def api_watchdog_toggle(request):
    global watchdog_enabled
    data = await request.json()
    watchdog_enabled = bool(data.get("enabled", True))
    return web.json_response({"watchdog_enabled": watchdog_enabled})


async def api_settings_get(request):
    """Recupere les parametres (ntfy topic, geonameid, etc.)."""
    try:
        conn = sqlite3.connect(str(DB_PATH))
        conn.execute("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)")
        conn.commit()
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM settings").fetchall()
        conn.close()
        return web.json_response({r["key"]: r["value"] for r in rows})
    except Exception:
        return web.json_response({})


async def api_settings_update(request):
    """Met a jour un parametre."""
    data = await request.json()
    try:
        conn = sqlite3.connect(str(DB_PATH))
        conn.execute("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)")
        for key, value in data.items():
            conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, str(value)))
        conn.commit()
        conn.close()
        return web.json_response({"success": True})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


async def api_device_rename(request):
    """Renomme un appareil."""
    device_id = _parse_device_id(request)
    if device_id is None:
        return web.json_response({"error": "ID invalide"}, status=400)
    data = await request.json()
    name = data.get("name", "").strip()
    if not name:
        return web.json_response({"error": "Nom requis"}, status=400)
    try:
        conn = sqlite3.connect(str(DB_PATH))
        conn.execute("UPDATE devices SET name=? WHERE id=?", (name, device_id))
        conn.commit()
        conn.close()
        return web.json_response({"success": True, "name": name})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


async def api_device_delete(request):
    """Supprime un appareil."""
    device_id = _parse_device_id(request)
    if device_id is None:
        return web.json_response({"error": "ID invalide"}, status=400)
    # Stop script if running
    stop_script(device_id)
    try:
        conn = sqlite3.connect(str(DB_PATH))
        conn.execute("DELETE FROM devices WHERE id=?", (device_id,))
        conn.commit()
        conn.close()
        return web.json_response({"success": True})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


async def api_device_toggle(request):
    """Active/desactive un appareil."""
    device_id = _parse_device_id(request)
    if device_id is None:
        return web.json_response({"error": "ID invalide"}, status=400)
    data = await request.json()
    enabled = 1 if data.get("enabled", True) else 0
    try:
        conn = sqlite3.connect(str(DB_PATH))
        conn.execute("UPDATE devices SET enabled=? WHERE id=?", (enabled, device_id))
        conn.commit()
        conn.close()
        return web.json_response({"success": True, "enabled": bool(enabled)})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


# ── WebSocket ─────────────────────────────────────

async def websocket_handler(request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    ws_clients.add(ws)
    # Envoyer les logs existants
    for device in db_get_devices():
        log_path = get_log_path(device["id"])
        content = read_log_file(log_path)
        if content.strip():
            try:
                await ws.send_str(json.dumps({
                    "type": "log_init", "device_id": device["id"], "content": content,
                }))
            except Exception:
                pass
    if events_timeline:
        await ws.send_str(json.dumps({"type": "events_init", "events": events_timeline[:30]}))
    try:
        shabbat = await fetch_shabbat_times()
        shabbat["is_shabbat"] = is_shabbat_now(shabbat)
        await ws.send_str(json.dumps({"type": "shabbat_times", "data": shabbat}))
    except Exception:
        pass
    try:
        async for msg in ws:
            pass
    finally:
        ws_clients.discard(ws)
    return ws


async def broadcast_logs():
    global ws_clients
    last_positions = {}
    last_sizes = {}
    while True:
        for device in db_get_devices():
            did = device["id"]
            log_path = get_log_path(did)
            if not log_path.exists():
                last_positions[did] = 0
                last_sizes[did] = 0
                continue
            try:
                content = read_log_file(log_path)
                cur = len(content)
                if cur < last_sizes.get(did, 0):
                    last_positions[did] = 0
                    last_sizes[did] = 0
                pos = last_positions.get(did, 0)
                if cur > pos:
                    new = content[pos:]
                    last_positions[did] = cur
                    last_sizes[did] = cur
                    if ws_clients and new.strip():
                        for line in new.strip().split("\n"):
                            ll = line.lower()
                            if "select" in ll and "envoi" in ll:
                                add_event(did, "select", "Select envoye")
                                db_add_event(did, "select", "Select envoye")
                            elif "error" in ll or "traceback" in ll:
                                add_event(did, "error", line.strip()[:100])
                                db_add_event(did, "error", line.strip()[:100])
                            elif "connect" in ll:
                                add_event(did, "connection", line.strip()[:100])
                                db_add_event(did, "connection", line.strip()[:100])
                        msg = json.dumps({"type": "log", "device_id": did, "content": new})
                        dead = set()
                        for ws in ws_clients:
                            try:
                                await ws.send_str(msg)
                            except Exception:
                                dead.add(ws)
                        ws_clients -= dead
                else:
                    last_sizes[did] = cur
            except Exception:
                pass
        await asyncio.sleep(1)


async def log_rotation():
    while True:
        for device in db_get_devices():
            try:
                log_path = get_log_path(device["id"])
                if log_path.exists() and log_path.stat().st_size > 5 * 1024 * 1024:
                    content = read_log_file(log_path)
                    log_path.write_text(content[-50000:], encoding="utf-8")
            except Exception:
                pass
        await asyncio.sleep(3600)


# ── App setup ─────────────────────────────────────

async def start_bg(app):
    app["log_broadcaster"] = asyncio.create_task(broadcast_logs())
    app["watchdog"] = asyncio.create_task(watchdog_loop())
    app["log_rotation"] = asyncio.create_task(log_rotation())


async def cleanup_bg(app):
    for t in ["log_broadcaster", "watchdog", "log_rotation"]:
        if t in app:
            app[t].cancel()


async def index_handler(request):
    return web.FileResponse(SCRIPT_DIR / "app.html")


async def manifest_handler(request):
    manifest = {
        "name": "Shabbat TV",
        "short_name": "Shabbat TV",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#f8f7ff",
        "theme_color": "#7c5ce0",
        "icons": [],
    }
    return web.json_response(manifest)


def create_app():
    init_db()
    app = web.Application()
    app.router.add_get("/", index_handler)
    app.router.add_get("/manifest.json", manifest_handler)
    # API dynamique — device_id au lieu de tv_id hardcode
    app.router.add_get("/api/devices", api_devices)
    app.router.add_get("/api/scan", api_scan)
    app.router.add_post("/api/pair/start", api_pair_start)
    app.router.add_post("/api/pair/pin", api_pair_pin)
    app.router.add_post("/api/pair/cancel", api_pair_cancel)
    app.router.add_get("/api/playback/{device_id}", api_playback)
    app.router.add_post("/api/command/{device_id}", api_command)
    app.router.add_get("/api/apps/{device_id}", api_apps)
    app.router.add_post("/api/script/start/{device_id}", api_script_start)
    app.router.add_post("/api/script/stop/{device_id}", api_script_stop)
    app.router.add_get("/api/logs/{device_id}", api_logs)
    app.router.add_get("/api/events", api_events)
    app.router.add_get("/api/server", api_server_info)
    app.router.add_get("/api/shabbat", api_shabbat)
    app.router.add_get("/api/history", api_history)
    app.router.add_post("/api/watchdog", api_watchdog_toggle)
    app.router.add_get("/api/settings", api_settings_get)
    app.router.add_post("/api/settings", api_settings_update)
    app.router.add_post("/api/device/toggle/{device_id}", api_device_toggle)
    app.router.add_post("/api/device/rename/{device_id}", api_device_rename)
    app.router.add_post("/api/device/delete/{device_id}", api_device_delete)
    app.router.add_get("/ws", websocket_handler)
    app.on_startup.append(start_bg)
    app.on_cleanup.append(cleanup_bg)
    return app


if __name__ == "__main__":
    print("=" * 50)
    print("  Shabbat TV Dashboard v4")
    print("  http://localhost:8080")
    print("=" * 50)
    devices = db_get_devices() if DB_PATH.exists() else []
    if devices:
        print(f"  {len(devices)} appareil(s) appaire(s)")
        for d in devices:
            print(f"    #{d['id']} {d['name']} ({d['address']})")
    else:
        print("  Aucun appareil. Lancez: python pair.py")
    print("=" * 50)
    app = create_app()
    web.run_app(app, host="0.0.0.0", port=8080)
