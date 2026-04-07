"""
Database connection and schema management using asyncpg
"""
import asyncpg
from config import DATABASE_URL

pool = None

async def init_db():
    global pool
    pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)
    async with pool.acquire() as conn:
        await conn.execute(SCHEMA)
    print(f"[DB] Connected to PostgreSQL, tables ready")

async def close_db():
    global pool
    if pool:
        await pool.close()

async def get_conn():
    return pool

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    first_name VARCHAR(100) NOT NULL DEFAULT '',
    last_name VARCHAR(100) DEFAULT '',
    gender VARCHAR(10),
    tradition VARCHAR(20) DEFAULT 'sephardi',
    havdalah_minutes INT DEFAULT 72,
    city_name VARCHAR(100) DEFAULT 'Paris',
    geonameid INT DEFAULT 2988507,
    timezone VARCHAR(50) DEFAULT 'Europe/Paris',
    language VARCHAR(5) DEFAULT 'fr',
    streaming_apps TEXT[] DEFAULT '{}',
    google_id VARCHAR(255),
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devices (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    device_type VARCHAR(20) DEFAULT 'appletv',
    identifier VARCHAR(255),
    address VARCHAR(50),
    credentials JSONB,
    strategy VARCHAR(20) DEFAULT 'generic',
    paired_at TIMESTAMP DEFAULT NOW(),
    last_seen TIMESTAMP,
    enabled BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS schedules (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    device_id INT REFERENCES devices(id) ON DELETE CASCADE,
    mode VARCHAR(20) DEFAULT 'shabbat',
    days TEXT[] DEFAULT '{fri}',
    start_time TIME,
    end_time TIME,
    auto_off BOOLEAN DEFAULT TRUE,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    device_id INT REFERENCES devices(id) ON DELETE SET NULL,
    type VARCHAR(30) NOT NULL,
    message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    device_info TEXT,
    connected_at TIMESTAMP DEFAULT NOW(),
    last_ping TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_schedules_user ON schedules(user_id);
"""
