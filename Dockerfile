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

# Copy configs
COPY deploy/nginx.conf /etc/nginx/sites-available/default
COPY deploy/supervisord.conf /etc/supervisor/conf.d/shabbattv.conf

# Environment
ENV SHABBAT_DB_PATH=/app/data/shabbat.db
ENV SHABBAT_LOG_DIR=/app/logs
ENV SHABBAT_PORT=8080
ENV PYTHONUNBUFFERED=1

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1/')" || exit 1

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/supervisord.conf"]
