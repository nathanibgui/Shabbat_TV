#!/usr/bin/env python3
"""
Shabbat TV - Appairage universel Apple TV
==========================================
Scanne le reseau, propose le choix de l'Apple TV,
appaire Companion + AirPlay, sauvegarde en DB.

Usage:
    python pair.py              # Scan + choix interactif + appairage
    python pair.py --scan       # Scan seul (liste les Apple TV)
    python pair.py --unpair ID  # Supprime un appareil appaire
    python pair.py --list       # Liste les appareils en DB
"""
import argparse
import asyncio
import json
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

try:
    import pyatv
    from pyatv.const import Protocol
except ImportError:
    print("Erreur: pyatv n'est pas installe.")
    print("  pip install pyatv")
    sys.exit(1)

SCRIPT_DIR = Path(__file__).parent
DB_PATH = SCRIPT_DIR / "shabbat.db"


# ── DB ────────────────────────────────────────────

def init_db():
    conn = sqlite3.connect(str(DB_PATH))
    c = conn.cursor()
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
    conn.commit()
    conn.close()


def db_save_device(name, address, identifier, credentials):
    conn = sqlite3.connect(str(DB_PATH))
    c = conn.cursor()
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    c.execute("""INSERT INTO devices (name, address, identifier, credentials, paired_at, last_seen)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON CONFLICT(identifier) DO UPDATE SET
                    name=excluded.name,
                    address=excluded.address,
                    credentials=excluded.credentials,
                    last_seen=excluded.last_seen""",
              (name, address, identifier, json.dumps(credentials), now, now))
    conn.commit()
    device_id = c.execute("SELECT id FROM devices WHERE identifier=?", (identifier,)).fetchone()[0]
    conn.close()
    return device_id


def db_list_devices():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT * FROM devices ORDER BY id").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def db_get_device(device_id):
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    row = conn.execute("SELECT * FROM devices WHERE id=?", (device_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def db_remove_device(device_id):
    conn = sqlite3.connect(str(DB_PATH))
    deleted = conn.execute("DELETE FROM devices WHERE id=?", (device_id,)).rowcount
    conn.commit()
    conn.close()
    return deleted > 0


def db_update_last_seen(identifier, address=None):
    conn = sqlite3.connect(str(DB_PATH))
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if address:
        conn.execute("UPDATE devices SET last_seen=?, address=? WHERE identifier=?",
                      (now, address, identifier))
    else:
        conn.execute("UPDATE devices SET last_seen=? WHERE identifier=?", (now, identifier))
    conn.commit()
    conn.close()


# ── Scan ──────────────────────────────────────────

async def scan_network(timeout=10):
    print(f"Scan du reseau ({timeout}s)...")
    atvs = await pyatv.scan(asyncio.get_running_loop(), timeout=timeout)
    if not atvs:
        print("Aucune Apple TV trouvee.")
        return []
    print(f"\n{len(atvs)} Apple TV trouvee(s):\n")
    for i, atv in enumerate(atvs):
        protocols = [s.protocol.name for s in atv.services]
        print(f"  [{i + 1}] {atv.name}")
        print(f"      IP: {atv.address}  |  ID: {atv.identifier}")
        print(f"      Protocoles: {', '.join(protocols)}")
        print()
    return atvs


# ── Appairage ─────────────────────────────────────

async def pair_protocol(atv, protocol):
    """Appaire un protocole, retourne les credentials ou None."""
    if protocol not in [s.protocol for s in atv.services]:
        print(f"  {protocol.name}: non disponible sur cet appareil")
        return None

    print(f"\n--- Appairage {protocol.name} ---")
    pairing = await pyatv.pair(atv, protocol, asyncio.get_running_loop())
    await pairing.begin()

    if pairing.device_provides_pin:
        print("Un code PIN s'affiche sur l'Apple TV.")
        pin = input("Entrez le code PIN: ").strip()
        if not pin:
            print("Annule.")
            await pairing.close()
            return None
        pairing.pin(int(pin))
    else:
        print("Verifiez votre Apple TV pour accepter l'appairage.")

    await pairing.finish()

    if pairing.has_paired:
        print(f"  {protocol.name}: OK")
        creds = pairing.service.credentials
        await pairing.close()
        return creds
    else:
        print(f"  {protocol.name}: ECHOUE")
        await pairing.close()
        return None


async def pair_device(atv):
    """Appaire Companion + AirPlay, retourne le dict credentials."""
    credentials = {}

    # Companion d'abord (controle distant)
    creds = await pair_protocol(atv, Protocol.Companion)
    if creds:
        credentials["Companion"] = creds

    # AirPlay ensuite
    creds = await pair_protocol(atv, Protocol.AirPlay)
    if creds:
        credentials["AirPlay"] = creds

    return credentials


# ── Commandes ─────────────────────────────────────

async def cmd_scan():
    await scan_network()


async def cmd_pair():
    atvs = await scan_network()
    if not atvs:
        return

    # Choix
    if len(atvs) == 1:
        choice = 0
        print(f"Selection automatique: {atvs[0].name}")
    else:
        raw = input("Choisissez une Apple TV (numero): ").strip()
        if not raw.isdigit() or int(raw) < 1 or int(raw) > len(atvs):
            print("Choix invalide.")
            return
        choice = int(raw) - 1

    atv = atvs[choice]
    print(f"\nAppairage de: {atv.name} ({atv.address})")

    # Verifier si deja appaire
    existing = db_list_devices()
    for dev in existing:
        if dev["identifier"] == str(atv.identifier):
            print(f"\nCet appareil est deja appaire (ID #{dev['id']}).")
            answer = input("Ré-appairer ? (o/n): ").strip().lower()
            if answer != "o":
                print("Annule.")
                return
            break

    credentials = await pair_device(atv)

    if not credentials:
        print("\nAucun protocole appaire. Verifiez que l'Apple TV accepte l'appairage.")
        return

    device_id = db_save_device(
        name=str(atv.name),
        address=str(atv.address),
        identifier=str(atv.identifier),
        credentials=credentials,
    )

    print(f"\nAppareil sauvegarde en DB (ID #{device_id})")
    print(f"  Nom: {atv.name}")
    print(f"  IP: {atv.address}")
    print(f"  Protocoles: {', '.join(credentials.keys())}")
    print(f"\nPour lancer le mode Shabbat:")
    print(f"  python shabbat_prime_video.py --start --device {device_id}")


def cmd_list():
    devices = db_list_devices()
    if not devices:
        print("Aucun appareil appaire.")
        return
    print(f"\n{len(devices)} appareil(s) appaire(s):\n")
    for dev in devices:
        creds = json.loads(dev["credentials"])
        protos = ", ".join(creds.keys()) if creds else "aucun"
        status = "actif" if dev["enabled"] else "desactive"
        print(f"  #{dev['id']}  {dev['name']}")
        print(f"      IP: {dev['address']}  |  ID: {dev['identifier']}")
        print(f"      Protocoles: {protos}  |  Status: {status}")
        print(f"      Appaire: {dev['paired_at']}  |  Vu: {dev['last_seen'] or 'jamais'}")
        print()


def cmd_unpair(device_id):
    dev = db_get_device(device_id)
    if not dev:
        print(f"Appareil #{device_id} introuvable.")
        return
    print(f"Suppression de: {dev['name']} ({dev['address']})")
    db_remove_device(device_id)
    print("Supprime.")


# ── Main ──────────────────────────────────────────

def main():
    init_db()

    parser = argparse.ArgumentParser(description="Shabbat TV - Appairage Apple TV")
    parser.add_argument("--scan", action="store_true", help="Scanner le reseau")
    parser.add_argument("--list", action="store_true", help="Lister les appareils appaires")
    parser.add_argument("--unpair", type=int, metavar="ID", help="Supprimer un appareil")

    args = parser.parse_args()

    if args.scan:
        asyncio.run(cmd_scan())
    elif args.list:
        cmd_list()
    elif args.unpair:
        cmd_unpair(args.unpair)
    else:
        # Mode par defaut = scan + appairage interactif
        asyncio.run(cmd_pair())


if __name__ == "__main__":
    main()
