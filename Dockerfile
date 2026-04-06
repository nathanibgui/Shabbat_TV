FROM python:3.11-slim

# Install nginx + supervisor
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies (pyatv optional on VPS)
RUN pip install --no-cache-dir aiohttp>=3.9.0 || true
RUN pip install --no-cache-dir pyatv>=0.14.0 || true

# Create app directories
WORKDIR /app
RUN mkdir -p /app/logs /app/data

# Copy Python backend
COPY server.py /app/
COPY shabbat_auto.py /app/
COPY pair.py /app/
COPY controllers/ /app/controllers/

# Copy web frontend
COPY app.html /usr/share/nginx/html/app.html
COPY manifest.json /usr/share/nginx/html/manifest.json
COPY sw.js /usr/share/nginx/html/sw.js

# Nginx config — proxy API to Python, serve static files
RUN cat > /etc/nginx/sites-available/default << 'EOF'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index app.html;

    # API + WebSocket → Python backend
    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /ws {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # Static files
    location / {
        try_files $uri $uri/ /app.html;
    }

    location /health {
        access_log off;
        return 200 'ok';
    }
}
EOF

# Supervisor config — run both nginx and python
RUN cat > /etc/supervisor/conf.d/shabbattv.conf << 'EOF'
[supervisord]
nodaemon=true
user=root

[program:nginx]
command=nginx -g "daemon off;"
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0

[program:python]
command=python -u /app/server.py
directory=/app
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
environment=SHABBAT_DB_PATH="/app/data/shabbat.db",SHABBAT_LOG_DIR="/app/logs",SHABBAT_PORT="8080",PYTHONUNBUFFERED="1"
EOF

# Environment
ENV SHABBAT_DB_PATH=/app/data/shabbat.db
ENV SHABBAT_LOG_DIR=/app/logs
ENV SHABBAT_PORT=8080
ENV PYTHONUNBUFFERED=1

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/health || exit 1

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/supervisord.conf"]
