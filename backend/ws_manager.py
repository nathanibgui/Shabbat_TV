"""
WebSocket Manager — tracks connected clients (web + mobile)
Enables VPS → client communication for remote TV control
"""
import json
import asyncio
from aiohttp import web
from auth import get_current_user

# Connected clients: { user_id: [websocket, ...] }
clients = {}


async def ws_handler(request):
    """WebSocket endpoint — /ws"""
    ws = web.WebSocketResponse()
    await ws.prepare(request)

    user_id = None

    try:
        async for msg in ws:
            if msg.type == web.WSMsgType.TEXT:
                try:
                    data = json.loads(msg.data)
                except Exception:
                    continue

                # Authentication message
                if data.get('type') == 'auth':
                    from auth import decode_token
                    try:
                        payload = decode_token(data.get('token', ''))
                        user_id = payload['user_id']
                        if user_id not in clients:
                            clients[user_id] = []
                        clients[user_id].append(ws)
                        await ws.send_json({
                            'type': 'auth_ok',
                            'user_id': user_id,
                            'connected_clients': len(clients.get(user_id, [])),
                        })
                        print(f"[WS] User {user_id} connected ({len(clients[user_id])} clients)")
                    except Exception:
                        await ws.send_json({'type': 'auth_error', 'message': 'Token invalide'})

                # Ping/pong keepalive
                elif data.get('type') == 'ping':
                    await ws.send_json({'type': 'pong'})

                # Device status update from mobile client
                elif data.get('type') == 'device_status' and user_id:
                    # Broadcast to other clients of the same user
                    await broadcast_to_user(user_id, {
                        'type': 'device_status',
                        'device_id': data.get('device_id'),
                        'status': data.get('status'),
                    }, exclude=ws)

                # Command response from mobile
                elif data.get('type') == 'command_result' and user_id:
                    await broadcast_to_user(user_id, {
                        'type': 'command_result',
                        'device_id': data.get('device_id'),
                        'command': data.get('command'),
                        'success': data.get('success'),
                    }, exclude=ws)

            elif msg.type == web.WSMsgType.ERROR:
                break

    finally:
        # Cleanup on disconnect
        if user_id and user_id in clients:
            clients[user_id] = [c for c in clients[user_id] if c != ws]
            if not clients[user_id]:
                del clients[user_id]
            print(f"[WS] User {user_id} disconnected ({len(clients.get(user_id, []))} remaining)")

    return ws


async def broadcast_to_user(user_id: int, message: dict, exclude=None):
    """Send a message to all connected clients of a user"""
    if user_id not in clients:
        return
    for ws in clients[user_id]:
        if ws != exclude and not ws.closed:
            try:
                await ws.send_json(message)
            except Exception:
                pass


async def send_command_to_user(user_id: int, command: dict):
    """Send a command from VPS to the user's connected clients (mobile/web)"""
    if user_id not in clients or not clients[user_id]:
        return False
    sent = False
    for ws in clients[user_id]:
        if not ws.closed:
            try:
                await ws.send_json(command)
                sent = True
            except Exception:
                pass
    return sent


def get_connected_users():
    """Return list of user IDs that have at least one connected client"""
    return list(clients.keys())


def is_user_connected(user_id: int) -> bool:
    return user_id in clients and len(clients[user_id]) > 0
