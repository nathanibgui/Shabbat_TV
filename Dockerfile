FROM python:3.11-slim

# Install nginx + supervisor
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip install --no-cache-dir \
    aiohttp>=3.9.0 \
    aiohttp-cors>=0.7.0 \
    asyncpg>=0.29.0 \
    pyjwt>=2.8.0 \
    bcrypt>=4.1.0

# Optional: pyatv for local TV control
RUN pip install --no-cache-dir pyatv>=0.14.0 || true

# Create app directories
WORKDIR /app
RUN mkdir -p /app/logs /app/data

# Copy legacy backend (v1 — SQLite, local control)
COPY server.py /app/
COPY shabbat_auto.py /app/
COPY pair.py /app/
COPY controllers/ /app/controllers/

# Copy new backend (v2 — PostgreSQL, cloud API)
COPY backend/ /app/backend/

# Copy web frontend
COPY app.html /usr/share/nginx/html/app.html
COPY manifest.json /usr/share/nginx/html/manifest.json
COPY sw.js /usr/share/nginx/html/sw.js

# Nginx config
COPY deploy/nginx.conf /etc/nginx/sites-available/default

# Supervisor config
COPY deploy/supervisord.conf /etc/supervisor/conf.d/shabbattv.conf

# Environment
ENV PYTHONUNBUFFERED=1
ENV SHABBAT_PORT=8080
ENV BACKEND_PORT=8081

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1/')" || exit 1

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/supervisord.conf"]
