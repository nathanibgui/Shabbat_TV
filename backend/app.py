#!/usr/bin/env python3
"""
ShabbatTV Backend API
=====================
- REST API (auth, devices, schedules, events, shabbat times)
- WebSocket (bidirectional VPS ↔ clients)
- PostgreSQL database
- Scheduler for automatic Shabbat mode
"""
import asyncio
import json
import urllib.request
from aiohttp import web
import aiohttp_cors

from config import PORT, HOST, GOOGLE_CLIENT_ID, DEFAULT_GEONAMEID
from db import init_db, close_db, get_conn
from auth import register, login, google_auth, me, update_me, require_auth, get_current_user
from ws_manager import ws_handler, get_connected_users, is_user_connected
from scheduler import run_scheduler, fetch_shabbat_times


# ── Device routes ──

@require_auth
async def list_devices(request):
    user = request['user']
    pool = await get_conn()
    async with pool.acquire() as conn:
        devices = await conn.fetch('SELECT * FROM devices WHERE user_id=$1 ORDER BY id', user['id'])
    return web.json_response([_device_to_dict(d) for d in devices])


@require_auth
async def create_device(request):
    user = request['user']
    data = await request.json()
    pool = await get_conn()
    async with pool.acquire() as conn:
        device = await conn.fetchrow(
            '''INSERT INTO devices (user_id, name, device_type, identifier, address, strategy)
               VALUES ($1, $2, $3, $4, $5, $6) RETURNING *''',
            user['id'], data.get('name', 'Mon appareil'),
            data.get('device_type', 'appletv'),
            data.get('identifier', ''), data.get('address', ''),
            data.get('strategy', 'generic'),
        )
    return web.json_response(_device_to_dict(device), status=201)


@require_auth
async def update_device(request):
    user = request['user']
    device_id = int(request.match_info['id'])
    data = await request.json()
    pool = await get_conn()
    async with pool.acquire() as conn:
        device = await conn.fetchrow('SELECT * FROM devices WHERE id=$1 AND user_id=$2', device_id, user['id'])
        if not device:
            return web.json_response({'error': 'Appareil non trouve'}, status=404)
        for key in ['name', 'device_type', 'strategy', 'address', 'identifier']:
            if key in data:
                await conn.execute(f'UPDATE devices SET {key}=$1 WHERE id=$2', data[key], device_id)
        updated = await conn.fetchrow('SELECT * FROM devices WHERE id=$1', device_id)
    return web.json_response(_device_to_dict(updated))


@require_auth
async def delete_device(request):
    user = request['user']
    device_id = int(request.match_info['id'])
    pool = await get_conn()
    async with pool.acquire() as conn:
        await conn.execute('DELETE FROM devices WHERE id=$1 AND user_id=$2', device_id, user['id'])
    return web.json_response({'deleted': True})


# ── Schedule routes ──

@require_auth
async def list_schedules(request):
    user = request['user']
    pool = await get_conn()
    async with pool.acquire() as conn:
        schedules = await conn.fetch('SELECT * FROM schedules WHERE user_id=$1 ORDER BY id', user['id'])
    return web.json_response([_schedule_to_dict(s) for s in schedules])


@require_auth
async def create_schedule(request):
    user = request['user']
    data = await request.json()
    pool = await get_conn()
    async with pool.acquire() as conn:
        sched = await conn.fetchrow(
            '''INSERT INTO schedules (user_id, device_id, mode, days, start_time, end_time, auto_off)
               VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *''',
            user['id'], data.get('device_id'),
            data.get('mode', 'shabbat'),
            data.get('days', ['fri']),
            data.get('start_time'), data.get('end_time'),
            data.get('auto_off', True),
        )
    return web.json_response(_schedule_to_dict(sched), status=201)


@require_auth
async def delete_schedule(request):
    user = request['user']
    schedule_id = int(request.match_info['id'])
    pool = await get_conn()
    async with pool.acquire() as conn:
        await conn.execute('DELETE FROM schedules WHERE id=$1 AND user_id=$2', schedule_id, user['id'])
    return web.json_response({'deleted': True})


# ── Events / Stats ──

@require_auth
async def list_events(request):
    user = request['user']
    pool = await get_conn()
    async with pool.acquire() as conn:
        events = await conn.fetch(
            'SELECT * FROM events WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',
            user['id']
        )
    return web.json_response([{
        'id': e['id'], 'type': e['type'], 'message': e['message'],
        'device_id': e['device_id'], 'created_at': str(e['created_at']),
    } for e in events])


@require_auth
async def get_stats(request):
    user = request['user']
    pool = await get_conn()
    async with pool.acquire() as conn:
        total_events = await conn.fetchval('SELECT COUNT(*) FROM events WHERE user_id=$1', user['id'])
        total_devices = await conn.fetchval('SELECT COUNT(*) FROM devices WHERE user_id=$1', user['id'])
        by_type = await conn.fetch(
            'SELECT type, COUNT(*) as count FROM events WHERE user_id=$1 GROUP BY type',
            user['id']
        )
    return web.json_response({
        'total_events': total_events,
        'total_devices': total_devices,
        'by_type': {r['type']: r['count'] for r in by_type},
        'is_connected': is_user_connected(user['id']),
    })


# ── Shabbat times ──

async def get_shabbat(request):
    """GET /api/v2/shabbat — public, no auth required"""
    geonameid = int(request.query.get('geonameid', DEFAULT_GEONAMEID))
    lang = request.query.get('lang', 'fr')
    lg = 'he' if lang == 'he' else 'fr' if lang == 'fr' else 's'

    try:
        url = f'https://www.hebcal.com/shabbat?cfg=json&geonameid={geonameid}&M=on&lg={lg}'
        loop = asyncio.get_event_loop()
        data = await loop.run_in_executor(
            None, lambda: json.loads(urllib.request.urlopen(url, timeout=10).read())
        )

        result = {'candle_lighting': None, 'havdalah': None, 'parasha': None}
        for item in data.get('items', []):
            if item.get('category') == 'candles':
                result['candle_lighting'] = item.get('date')
            elif item.get('category') == 'havdalah':
                result['havdalah'] = item.get('date')
            elif item.get('category') == 'parashat':
                result['parasha'] = item.get('title')
        return web.json_response(result)
    except Exception as e:
        return web.json_response({'error': str(e)}, status=500)


# ── Status ──

async def status(request):
    """GET /api/v2/status — public health check"""
    return web.json_response({
        'status': 'ok',
        'connected_users': len(get_connected_users()),
        'version': '2.0.0',
    })


# ── Helpers ──

def _device_to_dict(d):
    return {
        'id': d['id'], 'name': d['name'], 'device_type': d['device_type'],
        'identifier': d['identifier'] or '', 'address': d['address'] or '',
        'strategy': d['strategy'] or 'generic',
        'credentials': d['credentials'],
        'paired_at': str(d['paired_at']) if d['paired_at'] else None,
        'last_seen': str(d['last_seen']) if d['last_seen'] else None,
        'enabled': d['enabled'],
    }


def _schedule_to_dict(s):
    return {
        'id': s['id'], 'device_id': s['device_id'], 'mode': s['mode'],
        'days': list(s['days'] or []),
        'start_time': str(s['start_time']) if s['start_time'] else None,
        'end_time': str(s['end_time']) if s['end_time'] else None,
        'auto_off': s['auto_off'], 'enabled': s['enabled'],
    }


# ── App setup ──

async def on_startup(app):
    await init_db()
    # Start scheduler in background
    app['scheduler'] = asyncio.create_task(run_scheduler())


async def on_cleanup(app):
    app['scheduler'].cancel()
    await close_db()


def create_app():
    app = web.Application()

    # CORS
    cors = aiohttp_cors.setup(app, defaults={
        "*": aiohttp_cors.ResourceOptions(
            allow_credentials=True,
            expose_headers="*",
            allow_headers="*",
            allow_methods="*",
        )
    })

    # Auth routes
    cors.add(app.router.add_post('/api/v2/auth/register', register))
    cors.add(app.router.add_post('/api/v2/auth/login', login))
    cors.add(app.router.add_post('/api/v2/auth/google', google_auth))
    cors.add(app.router.add_get('/api/v2/auth/me', require_auth(me)))
    cors.add(app.router.add_put('/api/v2/auth/me', require_auth(update_me)))

    # Device routes
    cors.add(app.router.add_get('/api/v2/devices', list_devices))
    cors.add(app.router.add_post('/api/v2/devices', create_device))
    cors.add(app.router.add_put('/api/v2/devices/{id}', update_device))
    cors.add(app.router.add_delete('/api/v2/devices/{id}', delete_device))

    # Schedule routes
    cors.add(app.router.add_get('/api/v2/schedules', list_schedules))
    cors.add(app.router.add_post('/api/v2/schedules', create_schedule))
    cors.add(app.router.add_delete('/api/v2/schedules/{id}', delete_schedule))

    # Events / Stats
    cors.add(app.router.add_get('/api/v2/events', list_events))
    cors.add(app.router.add_get('/api/v2/stats', get_stats))

    # Shabbat times (public)
    cors.add(app.router.add_get('/api/v2/shabbat', get_shabbat))

    # Status (public)
    cors.add(app.router.add_get('/api/v2/status', status))

    # WebSocket
    app.router.add_get('/ws', ws_handler)

    # Lifecycle
    app.on_startup.append(on_startup)
    app.on_cleanup.append(on_cleanup)

    return app


if __name__ == '__main__':
    print("=" * 50)
    print("  ShabbatTV Backend API v2")
    print(f"  http://{HOST}:{PORT}")
    print("=" * 50)
    app = create_app()
    web.run_app(app, host=HOST, port=PORT)
