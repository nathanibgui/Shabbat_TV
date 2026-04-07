"""
Configuration — loads from environment variables
"""
import os

# Database
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://shabbattv:shabbattv@localhost:5432/shabbattv')

# JWT
JWT_SECRET = os.getenv('JWT_SECRET', 'shabbattv-secret-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRY_HOURS = 168  # 7 days

# Google OAuth
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', '752558880706-4fh0m4j075f7qjt0d1kqca1c0njr5ndm.apps.googleusercontent.com')

# Server
PORT = int(os.getenv('BACKEND_PORT', '8081'))
HOST = os.getenv('BACKEND_HOST', '0.0.0.0')

# Hebcal
DEFAULT_GEONAMEID = 2988507  # Paris
