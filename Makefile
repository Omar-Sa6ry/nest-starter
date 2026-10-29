# GNU Makefile for nest-starter

# Bare `make` prints the target list, exactly like bare `task`.
.DEFAULT_GOAL := help

.PHONY: help install ncu update dev build deploy clean start start-dev start-debug start-prod \
        lint format test test-watch test-cov test-debug test-e2e \
        health health-ready metrics \
        docker-dev-up docker-dev-down docker-dev-logs docker-dev-rebuild \
        docker-test-up docker-test-down docker-test-logs \
        docker-staging-up docker-staging-down docker-staging-logs \
        docker-prod-up docker-prod-down docker-prod-logs \
        db-up db-down redis-up redis-down down

# Base URL used by the health / metrics targets.
# Override per call: `make health APP_URL=http://localhost:8080`
APP_URL ?= http://localhost:3000

install:
		npm install

ncu:
		npx npm-check-updates

update:
		npx npm-check-updates -u
		npm install --legacy-peer-deps

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

docker-dev-up:
		docker compose --env-file environments/.env.development -f infrastructure/docker/development/docker-compose.yml up -d --build

docker-dev-down:
		docker compose --env-file environments/.env.development -f infrastructure/docker/development/docker-compose.yml down

docker-dev-logs:
		docker compose --env-file environments/.env.development -f infrastructure/docker/development/docker-compose.yml logs -f app

docker-dev-rebuild:
		docker compose --env-file environments/.env.development -f infrastructure/docker/development/docker-compose.yml down
		docker volume rm nest-starter-dev_app_node_modules 2> /dev/null || true
		docker compose --env-file environments/.env.development -f infrastructure/docker/development/docker-compose.yml up -d --build --force-recreate app

docker-test-up:
		docker compose --env-file environments/.env.test -f infrastructure/docker/test/docker-compose.yml up -d postgres redis

docker-test-down:
		docker compose --env-file environments/.env.test -f infrastructure/docker/test/docker-compose.yml down

docker-test-logs:
		docker compose --env-file environments/.env.test -f infrastructure/docker/test/docker-compose.yml logs -f app

docker-staging-up:
		docker compose --env-file environments/.env.staging -f infrastructure/docker/staging/docker-compose.yml up -d --build

docker-staging-down:
		docker compose --env-file environments/.env.staging -f infrastructure/docker/staging/docker-compose.yml down

docker-staging-logs:
		docker compose --env-file environments/.env.staging -f infrastructure/docker/staging/docker-compose.yml logs -f app

docker-prod-up:
		docker compose --env-file environments/.env.production -f infrastructure/docker/production/docker-compose.yml up -d --build

docker-prod-down:
		docker compose --env-file environments/.env.production -f infrastructure/docker/production/docker-compose.yml down

docker-prod-logs:
		docker compose --env-file environments/.env.production -f infrastructure/docker/production/docker-compose.yml logs -f app

db-up:
		docker compose --env-file environments/.env.development -f infrastructure/docker/development/docker-compose.yml up -d postgres

db-down:
		docker compose -f infrastructure/docker/development/docker-compose.yml stop postgres

redis-up:
		docker compose --env-file environments/.env.development -f infrastructure/docker/development/docker-compose.yml up -d redis

redis-down:
		docker compose -f infrastructure/docker/development/docker-compose.yml stop redis

down:
		docker compose --env-file environments/.env.development -f infrastructure/docker/development/docker-compose.yml down
		docker compose --env-file environments/.env.test -f infrastructure/docker/test/docker-compose.yml down
		docker compose --env-file environments/.env.staging -f infrastructure/docker/staging/docker-compose.yml down
		docker compose --env-file environments/.env.production -f infrastructure/docker/production/docker-compose.yml down

help:
	@echo "Available targets:"
	@echo ""
	@echo "  # Setup:"
	@echo "  make install       - npm install"
	@echo "  make ncu           - Check for outdated packages"
	@echo "  make update        - Update package.json to latest & install"
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
	@echo ""
	@echo "  make down          - Stop ALL nest-starter docker resources"
