#!/usr/bin/env bash
# ============================================================
#  fix_production.sh  —  Apply 3 production fixes on VPS
#  Run on VPS: bash scripts/fix_production.sh
# ============================================================
set -e
cd /opt/souk-ai

APP_SECRET="${WHATSAPP_APP_SECRET:?export WHATSAPP_APP_SECRET first}"
WABA_ID="${WHATSAPP_WABA_ID:?export WHATSAPP_WABA_ID first}"
TOKEN="${WHATSAPP_ACCESS_TOKEN:?export WHATSAPP_ACCESS_TOKEN first}"

echo "╔══════════════════════════════════════════════════╗"
echo "║  Souk.AI — Production Fix (3 issues)            ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── FIX 3: Re-enable HMAC security ──────────────────────────
echo "▶ [1/3] Re-enabling HMAC signature verification..."
if grep -q "^WHATSAPP_APP_SECRET="${WHATSAPP_APP_SECRET:?export WHATSAPP_APP_SECRET first}"s|^WHATSAPP_APP_SECRET=.*|WHATSAPP_APP_SECRET=${APP_SECRET}|" .env
else
    echo "WHATSAPP_APP_SECRET=${APP_SECRET}" >> .env
fi
echo "    ✅  WHATSAPP_APP_SECRET updated in .env"

# ── FIX 1: Permanent cloudflared tunnel ─────────────────────
echo ""
echo "▶ [2/3] Setting up permanent cloudflared tunnel..."

# Install cloudflared if not present
if ! command -v cloudflared &>/dev/null; then
    echo "    Installing cloudflared..."
    curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb
    dpkg -i /tmp/cloudflared.deb
    rm /tmp/cloudflared.deb
    echo "    ✅  cloudflared installed"
fi

# Create named tunnel if not exists
TUNNEL_NAME="souk-ai-prod"
TUNNEL_CREDS_DIR="/etc/cloudflared"
mkdir -p "$TUNNEL_CREDS_DIR"

if cloudflared tunnel list 2>/dev/null | grep -q "$TUNNEL_NAME"; then
    echo "    ℹ️  Tunnel '$TUNNEL_NAME' already exists"
    TUNNEL_UUID=$(cloudflared tunnel list 2>/dev/null | grep "$TUNNEL_NAME" | awk '{print $1}')
else
    echo "    Creating tunnel '$TUNNEL_NAME'..."
    echo "    NOTE: You need to run 'cloudflared tunnel login' first if not done."
    TUNNEL_UUID=$(cloudflared tunnel create "$TUNNEL_NAME" 2>/dev/null | grep -oP '(?<=ID: )[a-f0-9-]+' || true)
fi

if [ -n "$TUNNEL_UUID" ]; then
    # Get tunnel token
    TUNNEL_TOKEN=$(cloudflared tunnel token "$TUNNEL_NAME" 2>/dev/null || true)

    if [ -n "$TUNNEL_TOKEN" ]; then
        if grep -q "^CLOUDFLARED_TUNNEL_TOKEN=" .env; then
            sed -i "s|^CLOUDFLARED_TUNNEL_TOKEN=.*|CLOUDFLARED_TUNNEL_TOKEN=${TUNNEL_TOKEN}|" .env
        else
            echo "CLOUDFLARED_TUNNEL_TOKEN=${TUNNEL_TOKEN}" >> .env
        fi
        echo "    ✅  Tunnel token saved to .env"
        echo "    📌  Permanent webhook URL: https://${TUNNEL_UUID}.cfargotunnel.com/api/v1/whatsapp/webhook"
        echo ""
        echo "    ⚠️  UPDATE your Meta webhook URL to:"
        echo "         https://${TUNNEL_UUID}.cfargotunnel.com/api/v1/whatsapp/webhook"
    else
        echo "    ⚠️  Could not get tunnel token automatically."
        echo "         Run: cloudflared tunnel login && cloudflared tunnel create souk-ai-prod"
        echo "         Then: cloudflared tunnel token souk-ai-prod"
        echo "         Add result to .env as CLOUDFLARED_TUNNEL_TOKEN=<token>"
    fi
else
    echo "    ⚠️  Tunnel creation skipped — run 'cloudflared tunnel login' first (opens browser/URL)"
    echo "         After login: cloudflared tunnel create souk-ai-prod"
    echo "         Then:        cloudflared tunnel token souk-ai-prod"
    echo "         Add to .env: CLOUDFLARED_TUNNEL_TOKEN=<token>"
fi

# ── Git pull latest code ─────────────────────────────────────
echo ""
echo "▶ [3/3] Pulling latest code..."
git pull origin main
echo "    ✅  Code updated"

# ── Restart containers ───────────────────────────────────────
echo ""
echo "▶ Restarting containers with new config..."
docker compose up -d --force-recreate backend celery celery-beat cloudflared
echo "    ✅  Containers restarted"

# ── Verify ───────────────────────────────────────────────────
echo ""
echo "▶ Verifying services..."
sleep 5
docker compose ps --format "table {{.Name}}\t{{.Status}}"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  DONE — Next manual step:                       ║"
echo "║  Register OTP template (run once locally):      ║"
echo "║    python scripts/create_otp_template.py        ║"
echo "╚══════════════════════════════════════════════════╝"
