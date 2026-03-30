#!/bin/bash
# ══════════════════════════════════════════════════
# Souk.AI - Test WhatsApp Bot
# Usage: ./scripts/test_whatsapp.sh [BASE_URL]
# ══════════════════════════════════════════════════

BASE_URL="${1:-http://localhost:8000}"
API="$BASE_URL/api/v1"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
BOLD='\033[1m'

pass=0
fail=0

ok() { echo -e "  ${GREEN}✓${NC} $1"; ((pass++)); }
fail() { echo -e "  ${RED}✗${NC} $1"; [ -n "$2" ] && echo -e "    ${RED}→ $2${NC}"; ((fail++)); }
section() { echo -e "\n${BOLD}${BLUE}══════════════════════════════${NC}"; echo -e "${BOLD}${BLUE}  $1${NC}"; echo -e "${BOLD}${BLUE}══════════════════════════════${NC}"; }

section "1. VÉRIFICATION WEBHOOK (GET)"

# Test token valide
response=$(curl -s -o /dev/null -w "%{http_code}" \
  "$API/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=souk_ai_verify&hub.challenge=challenge123")

if [ "$response" = "200" ]; then
  ok "Webhook verification (token valide) → 200"
else
  fail "Webhook verification" "HTTP $response (attendu 200)"
fi

# Test token invalide
response=$(curl -s -o /dev/null -w "%{http_code}" \
  "$API/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=MAUVAIS_TOKEN&hub.challenge=test")

if [ "$response" = "403" ]; then
  ok "Webhook rejet mauvais token → 403"
else
  fail "Webhook mauvais token" "HTTP $response (attendu 403)"
fi

section "2. MESSAGE TEXTE ENTRANT (POST)"

# Message texte normal
response=$(curl -s -w "\n%{http_code}" -X POST "$API/whatsapp/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "212600000001",
            "type": "text",
            "text": {"body": "bonjour"},
            "id": "msg_test_001"
          }]
        }
      }]
    }]
  }')

http_code=$(echo "$response" | tail -n1)
if [ "$http_code" = "200" ]; then
  ok "Message texte 'bonjour' → 200"
else
  fail "Message texte" "HTTP $http_code"
fi

section "3. INTENTS WHATSAPP"

test_intent() {
  local msg="$1"
  local desc="$2"

  response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/whatsapp/webhook" \
    -H "Content-Type: application/json" \
    -d "{
      \"entry\": [{
        \"changes\": [{
          \"value\": {
            \"messages\": [{
              \"from\": \"212600000001\",
              \"type\": \"text\",
              \"text\": {\"body\": \"$msg\"},
              \"id\": \"msg_$(date +%s%N)\"
            }]
          }
        }]
      }]
    }")

  if [ "$response" = "200" ]; then
    ok "Intent: $desc ('$msg') → accepté"
  else
    fail "Intent: $desc" "HTTP $response"
  fi
  sleep 0.3
}

test_intent "combien j'ai vendu aujourd'hui" "GET_REPORT"
test_intent "ajoute 20 tomates à 3 dirhams" "ADD_SALE"
test_intent "stock actuel" "CHECK_STOCK"
test_intent "créer facture pour Ahmed 500 dirhams" "CREATE_INVOICE"
test_intent "lien dashboard" "DASHBOARD_LINK"
test_intent "bonjour comment ça va" "GREETING/UNKNOWN"

section "4. PAYLOAD VIDE / INVALIDE"

# Payload vide
response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/whatsapp/webhook" \
  -H "Content-Type: application/json" \
  -d '{"entry": []}')

if [ "$response" = "200" ]; then
  ok "Payload vide (entry=[]) → 200 (ignoré)"
else
  fail "Payload vide" "HTTP $response (attendu 200)"
fi

# Status update (pas un message)
response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/whatsapp/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "statuses": [{"id": "msg_001", "status": "delivered"}]
        }
      }]
    }]
  }')

if [ "$response" = "200" ]; then
  ok "Status update (delivery receipt) → 200 (ignoré)"
else
  fail "Status update" "HTTP $response"
fi

section "5. RÉSUMÉ"

total=$((pass + fail))
echo ""
echo -e "  Total:   $total tests"
echo -e "  ${GREEN}Réussis: $pass${NC}"
echo -e "  ${RED}Échoués: $fail${NC}"

if [ $fail -eq 0 ]; then
  echo -e "\n  ${GREEN}${BOLD}✓ WhatsApp webhook opérationnel!${NC}"
else
  echo -e "\n  ${RED}${BOLD}✗ $fail test(s) échoué(s)${NC}"
fi
echo ""
