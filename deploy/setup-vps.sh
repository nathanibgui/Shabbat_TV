#!/bin/bash
# ============================================================
# ShabbatTV — First-time VPS setup
# Run this ONCE on a fresh VPS (Ubuntu 24.04)
# Usage: ssh root@31.97.199.57 'bash -s' < setup-vps.sh
# ============================================================

set -e

echo "=== ShabbatTV VPS Setup ==="

# 1. Update system
echo "[1/4] Updating system..."
apt-get update -qq && apt-get upgrade -y -qq

# 2. Install Docker (if not present)
if ! command -v docker &> /dev/null; then
  echo "[2/4] Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
else
  echo "[2/4] Docker already installed"
fi

# 3. Install Docker Compose plugin (if not present)
if ! docker compose version &> /dev/null; then
  echo "[3/4] Installing Docker Compose..."
  apt-get install -y -qq docker-compose-plugin
else
  echo "[3/4] Docker Compose already installed"
fi

# 4. Create app directory
echo "[4/4] Creating directory..."
mkdir -p /opt/shabbattv/www

# 5. Open firewall ports
if command -v ufw &> /dev/null; then
  ufw allow 80/tcp
  ufw allow 443/tcp
  echo "Firewall: ports 80 and 443 opened"
fi

echo ""
echo "=== VPS ready ==="
echo "Docker: $(docker --version)"
echo "Compose: $(docker compose version)"
echo "Next: run deploy.sh from your local machine"
