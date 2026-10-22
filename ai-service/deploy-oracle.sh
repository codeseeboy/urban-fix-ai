#!/usr/bin/env bash
# Run this ON the Oracle Ubuntu VM after cloning the repo.
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v docker >/dev/null 2>&1; then
  echo "Installing Docker..."
  sudo apt-get update
  sudo apt-get install -y docker.io
  sudo systemctl enable --now docker
  sudo usermod -aG docker "$USER" || true
fi

if docker info >/dev/null 2>&1; then
  DOCKER="docker"
else
  echo "Using sudo for Docker (log out and back in once to drop sudo)."
  DOCKER="sudo docker"
fi

echo "Building image (10–20 min on first run)..."
$DOCKER build -t urbanfix-ai .

$DOCKER rm -f urbanfix-ai >/dev/null 2>&1 || true

$DOCKER run -d --name urbanfix-ai --restart unless-stopped \
  -p 8000:8000 \
  -e AI_DEVICE=cpu \
  -e AI_API_KEY="${AI_API_KEY:-}" \
  -e AI_CORS_ORIGINS="${AI_CORS_ORIGINS:-https://urban-fix-ai.onrender.com}" \
  -v urbanfix-hf-cache:/root/.cache \
  urbanfix-ai

echo
echo "Engine starting. First boot downloads YOLO/SigLIP weights (15+ min)."
echo "  $DOCKER logs -f urbanfix-ai"
echo "  curl http://127.0.0.1:8000/health"
echo "Then on Render set:"
echo "  AI_PROVIDER=fastapi"
echo "  AI_SERVICE_URL=http://YOUR_PUBLIC_IP:8000"
