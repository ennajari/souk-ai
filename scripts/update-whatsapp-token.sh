#!/bin/bash
# ============================================================
# Souk.AI - Mise a jour du token WhatsApp sur le VPS
# Utilisez ce script quand votre token expire
# Pour un token PERMANENT, suivez PERMANENT_TOKEN_GUIDE.md
# ============================================================

SOUK_DIR="/home/ubuntu/souk-ai"

echo "================================================"
echo "   Souk.AI - Mise a jour Token WhatsApp"
echo "================================================"
echo ""
echo "Comment obtenir un nouveau token:"
echo ""
echo "  1. Allez sur https://developers.facebook.com/apps/"
echo "  2. Cliquez sur votre app Souk.AI"
echo "  3. WhatsApp > Configuration API"
echo "  4. Section 'Token d acces temporaire'"
echo "  5. Cliquez 'Generer' (ou copiez le token visible)"
echo ""
read -p "Collez votre token WhatsApp ici: " NEW_TOKEN

if [ -z "$NEW_TOKEN" ]; then
    echo "Erreur: Token vide!"
    exit 1
fi

# Mettre a jour .env
if grep -q "WHATSAPP_ACCESS_TOKEN=" "$SOUK_DIR/.env"; then
    sed -i "s|WHATSAPP_ACCESS_TOKEN=.*|WHATSAPP_ACCESS_TOKEN=$NEW_TOKEN|" "$SOUK_DIR/.env"
else
    echo "WHATSAPP_ACCESS_TOKEN=$NEW_TOKEN" >> "$SOUK_DIR/.env"
fi

echo ""
echo "Token mis a jour dans .env"
echo ""
echo "Redemarrage des services..."
cd "$SOUK_DIR"
docker compose up -d --force-recreate backend celery

echo ""
echo "Services redemarres!"
echo ""
echo "Test de connexion WhatsApp..."
sleep 5

# Test rapide
PHONE_ID=$(grep "WHATSAPP_PHONE_NUMBER_ID=" "$SOUK_DIR/.env" | cut -d'=' -f2)
if [ -n "$PHONE_ID" ] && [ -n "$NEW_TOKEN" ]; then
    RESULT=$(curl -s -o /dev/null -w "%{http_code}" \
        "https://graph.facebook.com/v21.0/$PHONE_ID" \
        -H "Authorization: Bearer $NEW_TOKEN")

    if [ "$RESULT" = "200" ]; then
        echo "Token valide! WhatsApp operationnel."
    else
        echo "Attention: HTTP $RESULT - Verifiez votre token sur le portail Meta."
    fi
fi
