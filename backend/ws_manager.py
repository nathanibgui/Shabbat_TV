"""
WebSocket Manager — tracks connected clients (web + mobile + hub agents)
Enables VPS → client communication for remote TV control.

Two client roles:
  - 'remote' : web dashboard / mobile app (pilote, affiche le statut)
  - 'hub'    : hub agent sur le reseau local de l'utilisateur (execute
               les commandes TV via pyatv — PC, telephone Android, Pi)

Routing:
  remote --command/start/stop/status_request--> hubs
  hub    --hub_status/event/command_result----> remotes
  scheduler (VPS) --start/stop--> hubs, --notification--> tous
"""
import json
from aiohttp import web

# Connected clients: { user_id: [ {'ws': ws, 'role': 'remote'|'hub'}, ... ] }
clients = {}

# Messages emis par un hub, relayes aux remotes du meme utilisateur
HUB_TO_REMOTE_TYPES = {'hub_status', 'event', 'command_result',
                       'scan_result', 'device_status', 'state', 'log'}
# Messages emis par un remote, relayes aux hubs du meme utilisateur
REMOTE_TO_HUB_TYPES = {'command', 'start', 'stop', 'status_request', 'scan'}


async def ws_handler(request):
    """WebSocket endpoint — /ws"""
    ws = web.WebSocketResponse(heartbeat=55)
    await ws.prepare(request)

    user_id = None
    role = 'remote'

    try:
        async for msg in ws:
            if msg.type == web.WSMsgType.TEXT:
                try:
                    data = json.loads(msg.data)
                except Exception:
                    continue

                msg_type = data.get('type')

                # Authentication message
                if msg_type == 'auth':
                    from auth import decode_token
                    try:
                        payload = decode_token(data.get('token', ''))
                        user_id = payload['user_id']
                        role = data.get('role', 'remote')
                        if role not in ('remote', 'hub'):
                            role = 'remote'
                        clients.setdefault(user_id, []).append(
                            {'ws': ws, 'role': role}
                        )
                        await ws.send_json({
                            'type': 'auth_ok',
                            'user_id': user_id,
                            'role': role,
                            'hub_online': is_hub_connected(user_id),
                            'connected_clients': len(clients.get(user_id, [])),
                        })
                        print(f"[WS] User {user_id} connected as {role} "
                              f"({len(clients[user_id])} clients)")
                        if role == 'hub':
                            # Informer les remotes que le hub est en ligne
                            await send_to_remotes(user_id, {
                                'type': 'hub_online',
                                'hub_info': data.get('hub_info', {}),
                            })
                    except Exception:
                        await ws.send_json({'type': 'auth_error',
                                            'message': 'Token invalide'})

                # Ping/pong keepalive
                elif msg_type == 'ping':
                    await ws.send_json({'type': 'pong'})

                elif user_id is None:
                    continue  # tout le reste exige l'authentification

                # Hub -> remotes (statut, evenements, resultats)
                elif role == 'hub' and msg_type in HUB_TO_REMOTE_TYPES:
                    await send_to_remotes(user_id, data)

                # Remote -> hubs (commandes, start/stop manuels)
                elif role == 'remote' and msg_type in REMOTE_TO_HUB_TYPES:
                    sent = await send_to_hubs(user_id, data)
                    if not sent:
                        await ws.send_json({
                            'type': 'hub_offline',
                            'message': "Aucun hub connecte — verifiez que "
                                       "l'agent tourne sur votre reseau",
                        })

            elif msg.type == web.WSMsgType.ERROR:
                break

    finally:
        # Cleanup on disconnect
        if user_id and user_id in clients:
            clients[user_id] = [c for c in clients[user_id] if c['ws'] != ws]
            if not clients[user_id]:
                del clients[user_id]
            print(f"[WS] User {user_id} ({role}) disconnected "
                  f"({len(clients.get(user_id, []))} remaining)")
            # Si c'etait le dernier hub, prevenir les remotes
            if role == 'hub' and not is_hub_connected(user_id):
                await send_to_remotes(user_id, {'type': 'hub_offline'})

    return ws


async def _send_to(user_id: int, message: dict, roles, exclude=None) -> bool:
    """Envoie un message aux clients d'un utilisateur filtres par role."""
    sent = False
    for entry in clients.get(user_id, []):
        ws = entry['ws']
        if entry['role'] in roles and ws != exclude and not ws.closed:
            try:
                await ws.send_json(message)
                sent = True
            except Exception:
                pass
    return sent


async def broadcast_to_user(user_id: int, message: dict, exclude=None):
    """Send a message to ALL connected clients of a user (hubs + remotes)."""
    await _send_to(user_id, message, roles=('remote', 'hub'), exclude=exclude)


async def send_to_hubs(user_id: int, message: dict) -> bool:
    """Envoie aux hubs de l'utilisateur. True si au moins un hub a recu."""
    return await _send_to(user_id, message, roles=('hub',))


async def send_to_remotes(user_id: int, message: dict) -> bool:
    """Envoie aux clients remote (web/mobile) de l'utilisateur."""
    return await _send_to(user_id, message, roles=('remote',))


async def send_command_to_user(user_id: int, command: dict) -> bool:
    """Compat: envoie une commande d'execution -> cible les hubs."""
    return await send_to_hubs(user_id, command)


def get_connected_users():
    """Return list of user IDs that have at least one connected client"""
    return list(clients.keys())


def is_user_connected(user_id: int) -> bool:
    return user_id in clients and len(clients[user_id]) > 0


def is_hub_connected(user_id: int) -> bool:
    """True si l'utilisateur a au moins un hub agent connecte."""
    return any(c['role'] == 'hub' for c in clients.get(user_id, []))
