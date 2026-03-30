# ============================================================
# ShabbatTV Hub - Docker Image
# Runs the Python backend (server.py + shabbat_auto.py)
# on a Raspberry Pi or any Linux machine
# ============================================================
FROM python:3.11-slim

LABEL maintainer="ShabbatTV"
LABEL description="ShabbatTV Hub - Apple TV automation for Shabbat"

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    avahi-daemon \
    avahi-utils \
    libnss-mdns \
    dbus \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY server.py .
COPY shabbat_auto.py .
COPY pair.py .

# Create directories
RUN mkdir -p /app/logs /app/data

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV SHABBAT_DB_PATH=/app/data/shabbat.db
ENV SHABBAT_LOG_DIR=/app/logs
ENV SHABBAT_PORT=8080

# Expose API port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/api/devices')" || exit 1

# Start the server
CMD ["python", "-u", "server.py"]
