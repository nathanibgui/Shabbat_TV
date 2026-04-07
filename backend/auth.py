"""
Authentication — JWT tokens + Google OAuth + password hashing
"""
import jwt
import bcrypt
import time
import json
from datetime import datetime, timedelta
from aiohttp import web
from config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRY_HOURS, GOOGLE_CLIENT_ID
from db import get_conn


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_token(user_id: int, email: str) -> str:
    payload = {
        'user_id': user_id,
        'email': email,
        'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRY_HOURS),
        'iat': datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


async def get_current_user(request):
    """Extract user from Authorization header"""
    auth = request.headers.get('Authorization', '')
    if not auth.startswith('Bearer '):
        return None
    try:
        payload = decode_token(auth[7:])
        pool = await get_conn()
        async with pool.acquire() as conn:
            user = await conn.fetchrow('SELECT * FROM users WHERE id=$1', payload['user_id'])
            return dict(user) if user else None
    except Exception:
        return None


def require_auth(handler):
    """Decorator to require authentication"""
    async def wrapper(request):
        user = await get_current_user(request)
        if not user:
            return web.json_response({'error': 'Non autorise'}, status=401)
        request['user'] = user
        return await handler(request)
    return wrapper


# ── Routes ──

async def register(request):
    """POST /api/auth/register"""
    try:
        data = await request.json()
    except Exception:
        return web.json_response({'error': 'JSON invalide'}, status=400)

    email = (data.get('email') or '').strip().lower()
    password = data.get('password', '')
    first_name = (data.get('first_name') or '').strip()
    last_name = (data.get('last_name') or '').strip()

    if not email or '@' not in email:
        return web.json_response({'error': 'Email invalide'}, status=400)
    if not first_name:
        return web.json_response({'error': 'Prenom requis'}, status=400)
    if len(password) < 6:
        return web.json_response({'error': 'Mot de passe trop court (6 caracteres min)'}, status=400)

    pool = await get_conn()
    async with pool.acquire() as conn:
        existing = await conn.fetchrow('SELECT id FROM users WHERE email=$1', email)
        if existing:
            return web.json_response({'error': 'Email deja utilise'}, status=409)

        user = await conn.fetchrow(
            '''INSERT INTO users (email, password_hash, first_name, last_name,
               tradition, havdalah_minutes, language)
               VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *''',
            email, hash_password(password), first_name, last_name,
            data.get('tradition', 'sephardi'),
            72 if data.get('tradition') == 'sephardi' else 42,
            data.get('language', 'fr'),
        )

    token = create_token(user['id'], user['email'])
    return web.json_response({
        'token': token,
        'user': _user_to_dict(user),
    }, status=201)


async def login(request):
    """POST /api/auth/login"""
    try:
        data = await request.json()
    except Exception:
        return web.json_response({'error': 'JSON invalide'}, status=400)

    email = (data.get('email') or '').strip().lower()
    password = data.get('password', '')

    pool = await get_conn()
    async with pool.acquire() as conn:
        user = await conn.fetchrow('SELECT * FROM users WHERE email=$1', email)

    if not user or not user['password_hash']:
        return web.json_response({'error': 'Email ou mot de passe incorrect'}, status=401)
    if not verify_password(password, user['password_hash']):
        return web.json_response({'error': 'Email ou mot de passe incorrect'}, status=401)

    token = create_token(user['id'], user['email'])
    return web.json_response({
        'token': token,
        'user': _user_to_dict(user),
    })


async def google_auth(request):
    """POST /api/auth/google — login/register with Google token"""
    try:
        data = await request.json()
    except Exception:
        return web.json_response({'error': 'JSON invalide'}, status=400)

    google_token = data.get('token') or data.get('credential', '')
    if not google_token:
        return web.json_response({'error': 'Token Google requis'}, status=400)

    # Decode Google JWT (simple decode without verification for now)
    try:
        parts = google_token.split('.')
        if len(parts) == 3:
            import base64
            padded = parts[1] + '=' * (4 - len(parts[1]) % 4)
            payload = json.loads(base64.urlsafe_b64decode(padded))
        else:
            # It's an access token, fetch user info
            import urllib.request
            req = urllib.request.Request(
                'https://www.googleapis.com/oauth2/v2/userinfo',
                headers={'Authorization': f'Bearer {google_token}'}
            )
            resp = urllib.request.urlopen(req, timeout=10)
            payload = json.loads(resp.read())
    except Exception as e:
        return web.json_response({'error': f'Token Google invalide: {str(e)}'}, status=400)

    google_id = payload.get('sub') or payload.get('id', '')
    email = payload.get('email', '')
    first_name = payload.get('given_name', payload.get('name', ''))
    last_name = payload.get('family_name', '')
    picture = payload.get('picture', '')

    if not email:
        return web.json_response({'error': 'Email non fourni par Google'}, status=400)

    pool = await get_conn()
    async with pool.acquire() as conn:
        # Check if user exists
        user = await conn.fetchrow('SELECT * FROM users WHERE email=$1 OR google_id=$2', email, google_id)

        if user:
            # Update Google info
            await conn.execute(
                'UPDATE users SET google_id=$1, avatar_url=$2, updated_at=NOW() WHERE id=$3',
                google_id, picture, user['id']
            )
        else:
            # Create new user
            user = await conn.fetchrow(
                '''INSERT INTO users (email, first_name, last_name, google_id, avatar_url,
                   tradition, havdalah_minutes, language)
                   VALUES ($1, $2, $3, $4, $5, 'sephardi', 72, 'fr') RETURNING *''',
                email, first_name, last_name, google_id, picture
            )

    token = create_token(user['id'], email)
    return web.json_response({
        'token': token,
        'user': _user_to_dict(user),
    })


async def me(request):
    """GET /api/auth/me"""
    user = request['user']
    return web.json_response({'user': _user_to_dict(user)})


async def update_me(request):
    """PUT /api/auth/me — update profile"""
    user = request['user']
    try:
        data = await request.json()
    except Exception:
        return web.json_response({'error': 'JSON invalide'}, status=400)

    allowed = ['first_name', 'last_name', 'gender', 'tradition', 'havdalah_minutes',
               'city_name', 'geonameid', 'timezone', 'language', 'streaming_apps']

    pool = await get_conn()
    async with pool.acquire() as conn:
        for key in allowed:
            if key in data:
                val = data[key]
                if key == 'streaming_apps' and isinstance(val, list):
                    await conn.execute(f'UPDATE users SET {key}=$1, updated_at=NOW() WHERE id=$2', val, user['id'])
                else:
                    await conn.execute(f'UPDATE users SET {key}=$1, updated_at=NOW() WHERE id=$2', val, user['id'])
        updated = await conn.fetchrow('SELECT * FROM users WHERE id=$1', user['id'])

    return web.json_response({'user': _user_to_dict(updated)})


def _user_to_dict(user):
    return {
        'id': user['id'],
        'email': user['email'],
        'first_name': user['first_name'],
        'last_name': user['last_name'] or '',
        'gender': user['gender'],
        'tradition': user['tradition'],
        'havdalah_minutes': user['havdalah_minutes'],
        'city_name': user['city_name'],
        'geonameid': user['geonameid'],
        'timezone': user['timezone'] or 'Europe/Paris',
        'language': user['language'] or 'fr',
        'streaming_apps': list(user['streaming_apps'] or []),
        'google_id': user['google_id'],
        'avatar_url': user['avatar_url'],
        'created_at': str(user['created_at']),
    }
