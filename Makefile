# GNU Makefile for nest-starter

# Bare `make` prints the target list, exactly like bare `task`.
.DEFAULT_GOAL := help

.PHONY: help install ncu update dev build deploy clean start start-dev start-debug start-prod \
        lint format typecheck test test-watch test-cov test-debug test-e2e check check-all ci-check \
        health health-ready metrics \
        typeorm-migration-create typeorm-migration-generate typeorm-migration-run typeorm-migration-revert \
        dev-deps docker-dev-up docker-dev-down docker-dev-logs docker-dev-rebuild \
        docker-test-up docker-test-down docker-test-logs \
        docker-staging-up docker-staging-down docker-staging-logs docker-staging-rebuild \
        docker-prod-up docker-prod-down docker-prod-logs docker-prod-rebuild docker-prod-shell \
        db-up db-down redis-up redis-down redis-cli redis-flush s3-up s3-down \
        logs-app logs-db logs-redis logs-minio logs-prometheus \
        shell-app shell-db shell-redis shell-minio down prune reset

# Base URL used by the health / metrics targets.
# Override per call: `make health APP_URL=http://localhost:8080`
APP_URL ?= http://localhost:3000
COMPOSE_DEV  := docker compose --env-file environments/.env.development -f infrastructure/docker/development/docker-compose.yml
COMPOSE_TEST := docker compose --env-file environments/.env.test -f infrastructure/docker/test/docker-compose.yml
COMPOSE_STAGING := docker compose --env-file environments/.env.staging -f infrastructure/docker/staging/docker-compose.yml
COMPOSE_PROD := docker compose --env-file environments/.env.production -f infrastructure/docker/production/docker-compose.yml

install:
	npm install --legacy-peer-deps

ncu:
	npx npm-check-updates

update:
	npx npm-check-updates -u --target minor
	npm install --legacy-peer-deps

typecheck:
	npm run typecheck

dev:
	npm run start:dev

build:
	nest build

deploy:
	nest deploy

clean:
	npm run clean

start:
	nest start

start-dev:
	nest start --watch

start-debug:
	nest start --debug --watch

start-prod:
	NODE_ENV=production node dist/main

# Health & observability endpoints (GET, no auth)
health:
	curl -sS $(APP_URL)/health

health-ready:
	curl -sS $(APP_URL)/health/ready

metrics:
	curl -sS $(APP_URL)/metrics

lint:
	npm run lint

format:
	npm run format

test:
	npm run test

test-watch:
	npm run test:watch

test-cov:
	npm run test:cov

test-debug:
	npm run test:debug

test-e2e:
	npm run test:e2e

# Quality and Test Suites
check: lint typecheck test
check-all: lint typecheck test-cov test-e2e
ci-check: check-all

# Migrations:
typeorm-migration-create:
	npm run typeorm:migration:create

typeorm-migration-generate:
	npm run typeorm:migration:generate

typeorm-migration-run:
	npm run typeorm:migration:run

typeorm-migration-revert:
	npm run typeorm:migration:revert

dev-deps:
	$(COMPOSE_DEV) up -d postgres redis minio minio-init

docker-dev-up:
	$(COMPOSE_DEV) up -d --build

docker-dev-down:
	$(COMPOSE_DEV) down

docker-dev-logs:
	$(COMPOSE_DEV) logs -f app

docker-dev-rebuild:
	$(COMPOSE_DEV) down
	docker volume rm nest-starter-dev_app_node_modules 2> /dev/null || true
	$(COMPOSE_DEV) up -d --build --force-recreate app

docker-test-up:
	$(COMPOSE_TEST) up -d --remove-orphans postgres redis minio minio-init

docker-test-down:
	$(COMPOSE_TEST) down

docker-test-logs:
	$(COMPOSE_TEST) logs -f app

docker-staging-up:
	$(COMPOSE_STAGING) up -d --build

docker-staging-down:
	$(COMPOSE_STAGING) down

docker-staging-logs:
	$(COMPOSE_STAGING) logs -f app

docker-staging-rebuild:
	$(COMPOSE_STAGING) down
	$(COMPOSE_STAGING) up -d --build --force-recreate app

docker-prod-up:
	$(COMPOSE_PROD) up -d --build

docker-prod-down:
	$(COMPOSE_PROD) down

docker-prod-logs:
	$(COMPOSE_PROD) logs -f app

docker-prod-rebuild:
	$(COMPOSE_PROD) down
	$(COMPOSE_PROD) up -d --build --force-recreate app

docker-prod-shell:
	$(COMPOSE_PROD) exec app sh

db-up:
	$(COMPOSE_DEV) up -d postgres

db-down:
	$(COMPOSE_DEV) stop postgres

redis-up:
	$(COMPOSE_DEV) up -d redis

redis-down:
	$(COMPOSE_DEV) stop redis

redis-cli:
	$(COMPOSE_DEV) exec redis redis-cli

redis-flush:
	$(COMPOSE_DEV) exec redis redis-cli FLUSHALL

s3-up:
	$(COMPOSE_DEV) up -d minio

s3-down:
	$(COMPOSE_DEV) stop minio

logs-app:
	$(COMPOSE_DEV) logs -f app

logs-db:
	$(COMPOSE_DEV) logs -f postgres

logs-redis:
	$(COMPOSE_DEV) logs -f redis

logs-minio:
	$(COMPOSE_DEV) logs -f minio

logs-prometheus:
	$(COMPOSE_DEV) logs -f prometheus

shell-app:
	$(COMPOSE_DEV) exec app sh

shell-db:
	$(COMPOSE_DEV) exec postgres psql -U postgres -d nestdb

shell-redis:
	$(COMPOSE_DEV) exec redis sh

shell-minio:
	$(COMPOSE_DEV) exec minio sh

down:
	$(COMPOSE_DEV) down
	$(COMPOSE_TEST) down
	$(COMPOSE_STAGING) down
	$(COMPOSE_PROD) down

prune:
	docker system prune -f
	docker volume prune -f

reset:
	$(COMPOSE_DEV) down -v
	docker system prune -f
	$(COMPOSE_DEV) up -d --build

help:
	@echo "Available targets:"
	@echo ""
	@echo "  # Setup:"
	@echo "  make install       - npm install"
	@echo "  make ncu           - Check for outdated packages"
	@echo "  make update        - Update package.json to latest & install"
	@echo "  make typecheck     - Run TypeScript type checks"
	@echo "  make dev           - Start app in watch mode (environments/.env.development)"
	@echo ""
	@echo "  # Build & Run:"
	@echo "  make build         - Build production bundle"
	@echo "  make deploy        - Deploy the application"
	@echo "  make start         - Start app (nest start)"
	@echo "  make start-dev     - Start app in watch mode"
	@echo "  make start-debug   - Start app in debug mode"
	@echo "  make start-prod    - Start built app with NODE_ENV=production"
	@echo "  make clean         - Remove dist/, coverage/, tsbuildinfo"
	@echo ""
	@echo "  # Health & metrics (APP_URL=http://localhost:3000):"
	@echo "  make health        - curl /health (liveness + process stats)"
	@echo "  make health-ready  - curl /health/ready (PostgreSQL + Redis readiness)"
	@echo "  make metrics       - curl /metrics (Prometheus text)"
	@echo ""
	@echo "  # Quality:"
	@echo "  make lint          - Run oxlint"
	@echo "  make format        - Format source with Prettier"
	@echo ""
	@echo "  # Tests:"
	@echo "  make test          - Run unit tests (vitest run)"
	@echo "  make test-watch    - Run unit tests in watch mode (vitest)"
	@echo "  make test-cov      - Run unit tests with coverage (vitest run --coverage)"
	@echo "  make test-debug    - Run unit tests in debug mode (vitest --inspect-brk)"
	@echo "  make test-e2e      - Run e2e tests (brings up/down Docker test stack)"
	@echo "  make check         - Run fast checks (lint + typecheck + unit test)"
	@echo "  make check-all     - Run full suite (lint + typecheck + test-cov + test-e2e)"
	@echo ""
	@echo "  # Docker: Development:"
	@echo "  make docker-dev-up       - Start dev stack (app + postgres + redis)"
	@echo "  make docker-dev-down     - Stop dev stack"
	@echo "  make docker-dev-logs     - Tail dev app logs"
	@echo "  make docker-dev-rebuild  - Force rebuild dev app image (resets node_modules volume)"
	@echo ""
	@echo "  # Docker: Test:"
	@echo "  make docker-test-up      - Start test stack (app + postgres + redis)"
	@echo "  make docker-test-down    - Stop test stack"
	@echo "  make docker-test-logs    - Tail test app logs"
	@echo ""
	@echo "  # Docker: Staging:"
	@echo "  make docker-staging-up   - Start staging stack (nginx + app + db + redis + monitoring)"
	@echo "  make docker-staging-down - Stop staging stack"
	@echo "  make docker-staging-logs - Tail staging app logs"
	@echo ""
	@echo "  # Docker: Production:"
	@echo "  make docker-prod-up      - Start production stack (nginx + app + db + redis)"
	@echo "  make docker-prod-down    - Stop production stack"
	@echo "  make docker-prod-logs    - Tail production app logs"
	@echo ""
	@echo "  # Infra only:"
	@echo "  make db-up         - Start only postgres (dev)"
	@echo "  make db-down       - Stop postgres (dev)"
	@echo "  make redis-up      - Start only redis (dev)"
	@echo "  make redis-down    - Stop redis (dev)"
	@echo "  make redis-cli     - Connect to redis-cli in container"
	@echo "  make s3-up         - Start MinIO object storage (dev)"
	@echo "  make s3-down       - Stop MinIO"
	@echo ""
	@echo "  # Teardown & Maintenance:"
	@echo "  make down          - Stop ALL nest-starter docker resources"
	@echo "  make prune         - Prune dangling docker resources"
