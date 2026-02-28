#!/bin/bash
# ============================================================
# Souk.AI - Script de tunnel permanent (ngrok)
# A executer UNE FOIS sur le VPS pour un URL HTTPS permanent
# ============================================================
set -e

SOUK_DIR="/home/ubuntu/souk-ai"
NGROK_CONFIG="/etc/ngrok.yml"
NGROK_SERVICE="/etc/systemd/system/ngrok-souk.service"

echo "================================================"
echo "   Souk.AI - Configuration tunnel permanent"
echo "================================================"
echo ""

# ---- 1. Installer ngrok ----
if ! command -v ngrok &>/dev/null; then
    echo "[1/5] Installation de ngrok..."
    curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
    echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
    sudo apt-get update -qq && sudo apt-get install -y ngrok
else
    echo "[1/5] ngrok deja installe."
fi

# ---- 2. Configurer le token ngrok ----
echo ""
echo "[2/5] Configuration du token ngrok"
echo ""
echo "  >> Allez sur: https://dashboard.ngrok.com/signup"
echo "  >> Connectez-vous (gratuit)"
echo "  >> Allez dans 'Your Authtoken'"
echo "  >> Copiez votre token"
echo ""
read -p "Collez votre token ngrok ici: " NGROK_TOKEN

ngrok config add-authtoken "$NGROK_TOKEN"
echo "Token configure!"

# ---- 3. Obtenir le domaine statique gratuit ----
echo ""
echo "[3/5] Configuration du domaine statique"
echo ""
echo "  >> Dans le dashboard ngrok: https://dashboard.ngrok.com/domains"
echo "  >> Cliquez 'New Domain' (gratuit - 1 domaine statique inclus)"
echo "  >> Le domaine ressemble a: xxxx-yyyy-zzzz.ngrok-free.app"
echo ""
read -p "Collez votre domaine statique ngrok: " NGROK_DOMAIN

# ---- 4. Creer le fichier de config ngrok ----
echo ""
echo "[4/5] Creation de la configuration ngrok..."

cat > "$NGROK_CONFIG" << EOF
version: "2"
authtoken: $NGROK_TOKEN
tunnels:
  souk-api:
    proto: http
    addr: 8001
    domain: $NGROK_DOMAIN
EOF

echo "Config ngrok creee: $NGROK_CONFIG"

# ---- 5. Creer le service systemd pour ngrok ----
echo ""
echo "[5/5] Creation du service systemd ngrok..."

cat > "$NGROK_SERVICE" << EOF
[Unit]
Description=ngrok tunnel for Souk.AI
After=network.target docker.service
Wants=network-online.target

[Service]
Type=simple
User=ubuntu
ExecStart=/usr/bin/ngrok start --config /etc/ngrok.yml souk-api
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable ngrok-souk
sudo systemctl restart ngrok-souk

echo ""
sleep 3

# ---- 6. Verifier + afficher l'URL ----
TUNNEL_URL="https://$NGROK_DOMAIN"
echo ""
echo "================================================"
echo "   TUNNEL PERMANENT CONFIGURE!"
echo "================================================"
echo ""
echo "  URL permanente: $TUNNEL_URL"
echo "  Webhook Meta:   $TUNNEL_URL/api/v1/whatsapp/webhook"
echo ""
echo "  >> Copiez cette URL dans Meta Developer Portal:"
echo "     https://developers.facebook.com/apps/"
echo "     WhatsApp > Configuration > Webhook URL"
echo ""

# ---- 7. Mettre a jour .env si souhaite ----
read -p "Mettre a jour WEBHOOK_URL dans .env? (o/N): " UPDATE_ENV
if [[ "$UPDATE_ENV" =~ ^[Oo]$ ]]; then
    if grep -q "WEBHOOK_URL" "$SOUK_DIR/.env"; then
        sed -i "s|WEBHOOK_URL=.*|WEBHOOK_URL=$TUNNEL_URL|" "$SOUK_DIR/.env"
    else
        echo "WEBHOOK_URL=$TUNNEL_URL" >> "$SOUK_DIR/.env"
    fi
    echo ".env mis a jour!"
fi

echo ""
echo "Service ngrok status:"
sudo systemctl status ngrok-souk --no-pager
