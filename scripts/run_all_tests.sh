#!/bin/bash
# ══════════════════════════════════════════════════
# Souk.AI - Lancer tous les tests
# Usage: ./scripts/run_all_tests.sh [VPS_IP_OR_LOCALHOST]
# Exemple VPS:   ./scripts/run_all_tests.sh <VPS_IP>
# Exemple local: ./scripts/run_all_tests.sh localhost
# ══════════════════════════════════════════════════

HOST="${1:-localhost}"
BACKEND="http://$HOST:8000"
FRONTEND="http://$HOST:80"

BOLD='\033[1m'; BLUE='\033[0;34m'; GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'

echo -e "\n${BOLD}${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${BLUE}║     SOUK.AI - SUITE DE TESTS COMPLÈTE   ║${NC}"
echo -e "${BOLD}${BLUE}╚══════════════════════════════════════════╝${NC}"
echo -e "  Backend:  $BACKEND"
echo -e "  Frontend: $FRONTEND"
echo -e "  Date:     $(date '+%Y-%m-%d %H:%M:%S')\n"

# 1. Health check
echo -e "${BOLD}${BLUE}[1/4] Health Check${NC}"
bash "$(dirname "$0")/test_health.sh" "$HOST"

# 2. API complète
echo -e "${BOLD}${BLUE}[2/4] API Tests${NC}"
if command -v python3 &>/dev/null; then
  python3 "$(dirname "$0")/test_api.py" "$BACKEND"
elif command -v python &>/dev/null; then
  python "$(dirname "$0")/test_api.py" "$BACKEND"
else
  echo -e "  ${RED}✗ Python non installé - impossible de lancer test_api.py${NC}"
fi

# 3. WhatsApp webhook
echo -e "${BOLD}${BLUE}[3/4] WhatsApp Webhook${NC}"
bash "$(dirname "$0")/test_whatsapp.sh" "$BACKEND"

# 4. Frontend routes
echo -e "${BOLD}${BLUE}[4/4] Frontend Routes${NC}"
bash "$(dirname "$0")/test_frontend.sh" "$FRONTEND"

echo -e "\n${BOLD}${GREEN}✓ Tous les tests terminés!${NC}\n"
