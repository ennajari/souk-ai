#!/bin/bash
# ══════════════════════════════════════════════════
# Souk.AI - Health Check rapide de tous les services
# Usage: ./scripts/test_health.sh [VPS_IP]
# ══════════════════════════════════════════════════

VPS="${1:-localhost}"
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'; BOLD='\033[1m'

check() {
  local name="$1"; local url="$2"; local expected="${3:-200}"
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null)
  if [ "$code" = "$expected" ] || ([ "$expected" = "2xx" ] && [[ "$code" =~ ^2 ]]); then
    echo -e "  ${GREEN}✓${NC} $name → HTTP $code"
  else
    echo -e "  ${RED}✗${NC} $name → HTTP $code (attendu $expected)"
  fi
}

echo -e "\n${BOLD}Souk.AI - Health Check${NC}"
echo -e "VPS: $VPS\n"

echo -e "${BOLD}Services Backend${NC}"
check "API Backend (port 8000)"     "http://$VPS:8000/health"
check "API via Nginx (port 8080)"   "http://$VPS:8080/api/v1/health" "404"
check "Frontend (port 80)"          "http://$VPS:80"

echo -e "\n${BOLD}Endpoints API${NC}"
check "Health endpoint"             "http://$VPS:8000/health"
check "API docs (Swagger)"          "http://$VPS:8000/docs"
check "Auth register (schema)"      "http://$VPS:8000/api/v1/auth/me" "401"
check "WhatsApp webhook GET"        "http://$VPS:8000/api/v1/whatsapp/webhook" "403"

echo -e "\n${BOLD}Cloudflared Tunnel${NC}"
tunnel_url=$(docker logs cloudflared 2>/dev/null | grep trycloudflare | tail -1 | grep -o 'https://[^ |]*' 2>/dev/null)
if [ -n "$tunnel_url" ]; then
  echo -e "  ${GREEN}✓${NC} Tunnel actif: $tunnel_url"
  check "Webhook via tunnel" "$tunnel_url/api/v1/whatsapp/webhook" "403"
else
  echo -e "  ${YELLOW}○${NC} Tunnel cloudflared non détecté (SSH requis)"
fi

echo ""
