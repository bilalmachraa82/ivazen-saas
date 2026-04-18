#!/bin/bash
# One-shot helper to deploy the at-connector service to the VPS using the
# credentials documented in ~/Desktop/check-vps-status.sh (user+password).
# Rsyncs the local services/at-connector/ tree over SSH, rebuilds the
# Docker image, restarts the container, and prints a health probe.
#
# Usage (from repo root):
#   bash scripts/vps-deploy-at-connector.sh
# Optional env overrides:
#   VPS_IP=...  VPS_USER=...  VPS_PASSWORD=...  VPS_APP_DIR=...

set -euo pipefail

VPS_IP="${VPS_IP:-137.74.112.68}"
VPS_USER="${VPS_USER:-ubuntu}"
VPS_PASSWORD="${VPS_PASSWORD:?VPS_PASSWORD env var is required}"
VPS_APP_DIR="${VPS_APP_DIR:-/home/ubuntu/at-connector}"

SSH_COMMON=(
  -o StrictHostKeyChecking=accept-new
  -o UserKnownHostsFile=$HOME/.ssh/known_hosts
  -o PreferredAuthentications=password
  -o PubkeyAuthentication=no
)

if ! command -v sshpass >/dev/null 2>&1; then
  echo "sshpass is required; install via: brew install hudochenkov/sshpass/sshpass" >&2
  exit 1
fi

echo "▶ Probing SSH reachability to $VPS_IP:22"
if ! nc -zv -w 5 "$VPS_IP" 22 >/dev/null 2>&1; then
  echo "::error:: SSH port 22 on $VPS_IP is not reachable (fail2ban or firewall)." >&2
  exit 2
fi

echo "▶ Ensuring remote app dir exists: $VPS_APP_DIR"
sshpass -p "$VPS_PASSWORD" ssh "${SSH_COMMON[@]}" "$VPS_USER@$VPS_IP" "mkdir -p '$VPS_APP_DIR'"

echo "▶ Syncing services/at-connector/ to $VPS_USER@$VPS_IP:$VPS_APP_DIR/"
sshpass -p "$VPS_PASSWORD" rsync -az --delete \
  --exclude='node_modules' \
  --exclude='.git' \
  -e "ssh ${SSH_COMMON[*]}" \
  services/at-connector/ \
  "$VPS_USER@$VPS_IP:$VPS_APP_DIR/"

echo "▶ Rebuilding + restarting container on VPS"
sshpass -p "$VPS_PASSWORD" ssh "${SSH_COMMON[@]}" "$VPS_USER@$VPS_IP" "bash -s" <<EOF
set -euo pipefail
cd "$VPS_APP_DIR"

echo "[vps] Current container:"
docker ps -a --filter 'name=at-connector' --format 'table {{.Names}}\t{{.Status}}' || true

DOCKERFILE="Dockerfile.playwright"
[ -f Dockerfile.playwright ] || DOCKERFILE="Dockerfile"

echo "[vps] Building image from \$DOCKERFILE…"
docker build -f "\$DOCKERFILE" -t at-connector:latest .

CONTAINER=\$(docker ps -a --format '{{.Names}}' | grep -i '^at-connector\$' | head -1 || true)
if [ -z "\$CONTAINER" ]; then
  # First-time bring-up; require an existing .env file in the app dir.
  CONTAINER="at-connector"
  ENV_FLAG=""
  [ -f .env ] && ENV_FLAG="--env-file .env"
  echo "[vps] Starting new container \$CONTAINER (env: \$ENV_FLAG)"
  docker run -d --name "\$CONTAINER" --restart unless-stopped \$ENV_FLAG -p 8788:8788 at-connector:latest
else
  echo "[vps] Restarting existing container \$CONTAINER"
  docker stop "\$CONTAINER" 2>/dev/null || true
  docker rm "\$CONTAINER" 2>/dev/null || true
  ENV_FLAG=""
  [ -f .env ] && ENV_FLAG="--env-file .env"
  docker run -d --name "\$CONTAINER" --restart unless-stopped \$ENV_FLAG -p 8788:8788 at-connector:latest
fi

sleep 3
echo "[vps] Post-deploy state:"
docker ps --filter 'name=at-connector' --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
echo "[vps] Container logs (last 20):"
docker logs --tail 20 "\$CONTAINER" 2>&1 || true
EOF

echo "▶ Health probe"
curl -sS --max-time 10 "http://$VPS_IP:8788/health" -o /tmp/at-health.out -w "HTTP %{http_code}\n" || true
cat /tmp/at-health.out 2>/dev/null || true
echo

echo "✓ Deploy complete."
