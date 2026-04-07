"""
Scheduler — checks Shabbat times and sends commands to connected clients
Runs as a background task in the event loop
"""
import asyncio
import json
import urllib.request
from datetime import datetime, timedelta
from db import get_conn
from ws_manager import send_command_to_user, is_user_connected


async def run_scheduler():
    """Main scheduler loop — checks every 60 seconds"""
    print("[Scheduler] Started")
    while True:
        try:
            await check_schedules()
        except Exception as e:
            print(f"[Scheduler] Error: {e}")
        await asyncio.sleep(60)


async def check_schedules():
    """Check all active schedules and send commands if needed"""
    pool = await get_conn()
    if not pool:
        return

    async with pool.acquire() as conn:
        # Get all users with active schedules
        users = await conn.fetch('''
            SELECT DISTINCT u.id, u.geonameid, u.tradition, u.havdalah_minutes
            FROM users u
            JOIN schedules s ON s.user_id = u.id
            WHERE s.enabled = TRUE
        ''')

    now = datetime.now()

    for user in users:
        user_id = user['id']
        if not is_user_connected(user_id):
            continue

        # Check Shabbat mode
        async with pool.acquire() as conn:
            shabbat_schedules = await conn.fetch(
                "SELECT * FROM schedules WHERE user_id=$1 AND mode='shabbat' AND enabled=TRUE",
                user_id
            )

        if shabbat_schedules:
            shabbat_times = await fetch_shabbat_times(user['geonameid'])
            if shabbat_times:
                candle = parse_iso(shabbat_times.get('candle_lighting'))
                havdalah = parse_iso(shabbat_times.get('havdalah'))

                if candle and havdalah:
                    # 1h before — prepare notification
                    if candle - timedelta(hours=1) <= now <= candle - timedelta(minutes=59):
                        await send_command_to_user(user_id, {
                            'type': 'notification',
                            'message': 'Shabbat dans 1 heure !',
                            'shabbat_times': shabbat_times,
                        })

                    # Shabbat started — activate
                    if candle <= now <= candle + timedelta(minutes=1):
                        await send_command_to_user(user_id, {
                            'type': 'start',
                            'mode': 'shabbat',
                            'message': 'Shabbat Shalom ! Mode Shabbat active.',
                        })
                        # Log event
                        async with pool.acquire() as conn:
                            await conn.execute(
                                "INSERT INTO events (user_id, type, message) VALUES ($1, 'shabbat', 'Mode Shabbat active automatiquement')",
                                user_id
                            )

                    # Shabbat ended — deactivate
                    if havdalah <= now <= havdalah + timedelta(minutes=1):
                        await send_command_to_user(user_id, {
                            'type': 'stop',
                            'message': 'Shabbat termine. Shavua Tov !',
                        })
                        async with pool.acquire() as conn:
                            await conn.execute(
                                "INSERT INTO events (user_id, type, message) VALUES ($1, 'shabbat', 'Mode Shabbat desactive (Havdalah)')",
                                user_id
                            )

        # Check scheduled (timed) modes
        async with pool.acquire() as conn:
            timed_schedules = await conn.fetch(
                "SELECT * FROM schedules WHERE user_id=$1 AND mode='scheduled' AND enabled=TRUE",
                user_id
            )

        day_map = {'mon': 0, 'tue': 1, 'wed': 2, 'thu': 3, 'fri': 4, 'sat': 5, 'sun': 6}
        today = now.weekday()

        for sched in timed_schedules:
            days = list(sched['days'] or [])
            for day_str in days:
                if day_map.get(day_str) == today:
                    start = sched['start_time']
                    end = sched['end_time']
                    current_time = now.time()

                    # Start time reached
                    if start and abs_time_diff(current_time, start) < 60:
                        await send_command_to_user(user_id, {
                            'type': 'start',
                            'mode': 'scheduled',
                            'message': f'Programme demarre ({start})',
                        })

                    # End time reached
                    if end and sched['auto_off'] and abs_time_diff(current_time, end) < 60:
                        await send_command_to_user(user_id, {
                            'type': 'stop',
                            'message': f'Programme termine ({end})',
                        })


def abs_time_diff(t1, t2):
    """Difference in seconds between two time objects"""
    s1 = t1.hour * 3600 + t1.minute * 60 + t1.second
    s2 = t2.hour * 3600 + t2.minute * 60 + t2.second
    return abs(s1 - s2)


def parse_iso(iso_str):
    if not iso_str:
        return None
    try:
        return datetime.fromisoformat(iso_str.replace('Z', '+00:00')).replace(tzinfo=None)
    except Exception:
        return None


_shabbat_cache = {}

async def fetch_shabbat_times(geonameid):
    """Fetch Shabbat times from Hebcal (cached for 1 hour)"""
    cache_key = f"{geonameid}_{datetime.now().strftime('%Y%m%d%H')}"
    if cache_key in _shabbat_cache:
        return _shabbat_cache[cache_key]

    try:
        url = f'https://www.hebcal.com/shabbat?cfg=json&geonameid={geonameid}&M=on'
        loop = asyncio.get_event_loop()
        data = await loop.run_in_executor(None, lambda: json.loads(urllib.request.urlopen(url, timeout=10).read()))

        result = {'candle_lighting': None, 'havdalah': None, 'parasha': None}
        for item in data.get('items', []):
            if item.get('category') == 'candles':
                result['candle_lighting'] = item.get('date')
            elif item.get('category') == 'havdalah':
                result['havdalah'] = item.get('date')
            elif item.get('category') == 'parashat':
                result['parasha'] = item.get('title')

        _shabbat_cache[cache_key] = result
        return result
    except Exception as e:
        print(f"[Scheduler] Hebcal error: {e}")
        return None
