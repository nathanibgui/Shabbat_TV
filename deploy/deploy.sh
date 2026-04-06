#!/bin/bash
# ============================================================
# ShabbatTV — Deploy to VPS (uses existing Traefik)
# Usage: bash deploy.sh
# ============================================================

set -e

VPS_IP="31.97.199.57"
VPS_USER="root"
REMOTE_DIR="/docker/shabbattv"

echo "=== ShabbatTV Deploy ==="
echo "VPS: $VPS_USER@$VPS_IP"
echo "URL: https://shabbat.nathanibgui.com"
echo ""

# 1. Create remote directory
echo "[1/5] Creating remote directory..."
ssh $VPS_USER@$VPS_IP "mkdir -p $REMOTE_DIR/www"

# 2. Copy files
echo "[2/5] Copying files..."
scp docker-compose.yml $VPS_USER@$VPS_IP:$REMOTE_DIR/
scp nginx.conf $VPS_USER@$VPS_IP:$REMOTE_DIR/
scp ../app.html $VPS_USER@$VPS_IP:$REMOTE_DIR/www/

# 3. Check Traefik network exists
echo "[3/5] Checking Traefik network..."
ssh $VPS_USER@$VPS_IP "docker network inspect n8n_default >/dev/null 2>&1 || echo 'WARNING: n8n_default network not found. Traefik must be running.'"

# 4. Start container
echo "[4/5] Starting ShabbatTV..."
ssh $VPS_USER@$VPS_IP "cd $REMOTE_DIR && docker compose up -d"

# 5. Verify
echo "[5/5] Verifying..."
sleep 3
ssh $VPS_USER@$VPS_IP "docker ps | grep shabbattv"

echo ""
echo "=== Deploy complete ==="
echo "https://shabbat.nathanibgui.com"
