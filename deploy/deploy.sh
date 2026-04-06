#!/bin/bash
# ============================================================
# ShabbatTV — Deploy to VPS
# Usage: ./deploy.sh [domain]
# Example: ./deploy.sh shabbattv.example.com
#          ./deploy.sh  (uses IP directly)
# ============================================================

set -e

VPS_IP="31.97.199.57"
VPS_USER="root"
DOMAIN="${1:-$VPS_IP}"
REMOTE_DIR="/opt/shabbattv"

echo "=== ShabbatTV Deploy ==="
echo "VPS: $VPS_USER@$VPS_IP"
echo "Domain: $DOMAIN"
echo "Remote: $REMOTE_DIR"
echo ""

# 1. Create remote directory
echo "[1/5] Creating remote directory..."
ssh $VPS_USER@$VPS_IP "mkdir -p $REMOTE_DIR/www"

# 2. Copy files
echo "[2/5] Copying files..."
scp docker-compose.yml $VPS_USER@$VPS_IP:$REMOTE_DIR/
scp Caddyfile $VPS_USER@$VPS_IP:$REMOTE_DIR/
scp ../app.html $VPS_USER@$VPS_IP:$REMOTE_DIR/www/

# 3. Copy manifest.json if exists
if [ -f "../manifest.json" ]; then
  scp ../manifest.json $VPS_USER@$VPS_IP:$REMOTE_DIR/www/
fi

# 4. Set domain and start
echo "[3/5] Setting domain to: $DOMAIN"
ssh $VPS_USER@$VPS_IP "cd $REMOTE_DIR && echo 'DOMAIN=$DOMAIN' > .env"

echo "[4/5] Starting containers..."
ssh $VPS_USER@$VPS_IP "cd $REMOTE_DIR && docker compose pull && docker compose up -d"

echo "[5/5] Checking health..."
sleep 3
ssh $VPS_USER@$VPS_IP "curl -s -o /dev/null -w '%{http_code}' http://localhost/health || echo 'waiting...'"

echo ""
echo "=== Deploy complete ==="
if [ "$DOMAIN" = "$VPS_IP" ]; then
  echo "Access: http://$VPS_IP"
else
  echo "Access: https://$DOMAIN"
fi
echo "Logs: ssh $VPS_USER@$VPS_IP 'cd $REMOTE_DIR && docker compose logs -f'"
