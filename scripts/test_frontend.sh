#!/bin/bash
# ══════════════════════════════════════════════════
# Souk.AI - Test routes frontend
# Usage: ./scripts/test_frontend.sh [FRONTEND_URL]
# ══════════════════════════════════════════════════

FRONTEND="${1:-http://localhost:80}"
GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'; BOLD='\033[1m'

pass=0; fail=0

check_route() {
  local route="$1"
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$FRONTEND$route")
  if [[ "$code" =~ ^2 ]]; then
    echo -e "  ${GREEN}✓${NC} $route → $code"
    ((pass++))
  else
    echo -e "  ${RED}✗${NC} $route → $code"
    ((fail++))
  fi
}

echo -e "\n${BOLD}Test routes Frontend ($FRONTEND)${NC}\n"

# SPA routes - toutes retournent 200 avec index.html
routes=(
  "/"
  "/login"
  "/register"
  "/dashboard"
  "/products"
  "/inventory"
  "/sales"
  "/pos"
  "/analytics"
  "/forecasts"
  "/suppliers"
  "/credit"
  "/customers"
  "/profit"
  "/notifications"
  "/coach"
  "/employees"
  "/my-catalogue"
  "/marketplace"
  "/payments"
  "/market-intelligence"
  "/settings"
  "/sage-import"
  "/admin"
)

for route in "${routes[@]}"; do
  check_route "$route"
done

echo ""
echo -e "${BOLD}Assets statiques${NC}"
check_route "/assets/"

echo ""
echo -e "  Total: $((pass+fail)) | ${GREEN}OK: $pass${NC} | ${RED}KO: $fail${NC}"
echo ""
