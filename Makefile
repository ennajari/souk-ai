# Souk.AI — common tasks. `make help` lists them.
.PHONY: help up down logs migrate seed test-up test test-down lint build audit backup

help:            ## List targets
	@grep -E '^[a-z-]+:.*##' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-10s %s\n", $$1, $$2}'

up:              ## Start the full stack (copy .env.example to .env first)
	docker compose up -d --build
	docker compose exec backend alembic upgrade head

down:            ## Stop the stack
	docker compose down

logs:            ## Tail backend logs
	docker compose logs -f backend

migrate:         ## Apply database migrations
	docker compose exec backend alembic upgrade head

seed:            ## Demo shop with 30 days of history: login 0600000001 / $$DEMO_PASSWORD (default Demo-2026!)
	docker compose exec backend python -m scripts.seed_demo

test-up:         ## Start throwaway Postgres + Redis for tests
	docker run -d --rm --name souk-test-pg -e POSTGRES_USER=souk -e POSTGRES_PASSWORD=souk -e POSTGRES_DB=souk_test -p 55432:5432 postgres:16-alpine
	docker run -d --rm --name souk-test-redis -p 56379:6379 redis:7-alpine

test:            ## Backend tests (needs `make test-up` once)
	cd backend && python -m pytest -q

test-down:       ## Remove test containers
	docker rm -f souk-test-pg souk-test-redis

lint:            ## Backend lint
	cd backend && ruff check .

build:           ## Frontend production build
	cd frontend && npm ci && npm run build

audit:           ## Dependency vulnerability scans
	cd backend && pip-audit -r requirements.txt
	cd frontend && npm audit --omit=dev --audit-level=high

backup:          ## One-off database backup (dev stack) into ./backups
	mkdir -p backups
	docker compose exec -T postgres pg_dump -U $${POSTGRES_USER:-souk_user} -Fc $${POSTGRES_DB:-souk_db} > backups/souk-$$(date +%Y%m%d-%H%M%S).dump
