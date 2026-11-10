# @bts-soft/create-starter

CLI template generator for initializing enterprise-grade NestJS 12 production backends based on the official template repository `Omar-Sa6ry/nest-starter`.

---

## Overview

`@bts-soft/create-starter` provides a zero-configuration command line interface that scaffolds, rebrands, and provisions a production-ready NestJS 12 backend in seconds.

Instead of cloning repositories manually and searching through dozens of configuration files to replace identifiers, this CLI automates the entire provisioning workflow:

1. Downloads the latest clean snapshot of `Omar-Sa6ry/nest-starter` from GitHub without git history.
2. Purges internal starter scaffolding directories that are unnecessary in end projects (such as `create-starter/` and `media-frontend/`).
3. Recursively scans configuration files, Docker Compose definitions, Prometheus configs, environment files, and manifests to replace all starter branding, package identifiers, database schemas, and service names with your chosen project name.
4. Updates dependencies to their latest compatible versions via `npm run update`.
5. Executes dependency installation via `make install` (`npm install --legacy-peer-deps`).
6. Outputs clear, actionable instructions for launching backing containers and starting development.

---

## What the Generated Architecture Includes

Every application scaffolded by `@bts-soft/create-starter` comes fully configured with:

- NestJS 12 running on Node.js 22+ with native ECMAScript Modules (ESM) and Express 5.
- Code-first GraphQL powered by Apollo Server with automatic schema generation and unified response envelopes.
- PostgreSQL persistence managed via TypeORM with auto-loading entities, migrations, and health checks.
- Redis integration for high-performance key-value caching, session management, and sliding-window rate limiting.
- JWT Authentication with cryptographically secure refresh token rotation and revocation blacklisting.
- Role-Based Access Control (RBAC) with granular permissions and field/operation level authorization guards.
- Google OAuth 2.0 social login integration.
- S3 and MinIO compatible object storage integration with direct presigned multipart uploads, quotas, and BullMQ background processing.
- Realtime WebSocket gateway built with Socket.IO and clustered using `@socket.io/redis-adapter`.
- Decoupled notification system with transactional outbox pattern, BullMQ queues, dead-letter queues (DLQ), and multi-channel dispatchers (Email, SMS, Push, In-App).
- Unified payment engine supporting Stripe, PayPal, Paymob, and Fawry Pay with webhook signature validation and idempotency.
- Dual-language internationalization (English and Arabic) via `nestjs-i18n`.
- Observability suite including Prometheus metric collection (`/metrics`), Kubernetes-ready health probes (`/health`, `/health/ready`), and correlation-traced structured logging.
- Isolated multi-stage Docker Compose stacks for Development, Test, Staging, and Production.

---

## System Requirements

Before running the generator, verify that your environment satisfies the following requirements:

- Node.js: Version 22.0.0 or higher
- npm: Version 10.0.0 or higher
- Docker and Docker Compose: Required for containerized databases, Redis, MinIO, and monitoring services
- GNU Make: Recommended for invoking make automation targets (supported on Linux, macOS, and Windows via Git Bash or WSL)

---

## Quick Start

### 1. Run the Generator

You can run the generator directly using `npm create` without installing any package globally:

```bash
npm create @bts-soft/starter my-new-project
```

Or using `npx`:

```bash
npx @bts-soft/create-starter my-new-project
```

If you omit the project name argument, the CLI will prompt you interactively:

```bash
npm create @bts-soft/starter
```

### 2. Valid Project Names

The project name must start with an alphanumeric character and may only contain alphanumeric characters, dots (`.`), underscores (`_`), and hyphens (`-`).

Examples of valid project names:
- `order-service`
- `core_api`
- `fintech-backend`
- `acme.portal`

---

## Automated Scaffolding Workflow

When you execute the generator, the following operations are performed in order:

### Step 1: Template Cloning
The CLI downloads the repository snapshot from `Omar-Sa6ry/nest-starter#main` (falling back to `#master` if unavailable) using `degit`. No Git commit history is downloaded, providing a clean, fresh repository state.

### Step 2: Workspace Sanitization
Internal generator scaffolding files that are only needed by the starter author are permanently removed:
- `create-starter/` (the generator itself)
- `media-frontend/` (sample browser upload testing harness)

### Step 3: Deep Identifier Replacement
The CLI traverses all source code files, Docker Compose files, Makefiles, environment files, and documentation to apply dynamic identifier replacements:

| Original Starter Placeholder | Replaced Value in Your Project | Context |
|---|---|---|
| `@bts-soft/nest-starter` | `<project-name>` | Package name in `package.json` |
| `Nest Starter` | `<Project Name>` | User-facing logs and OpenAPI/GraphQL titles |
| `nest-starter` | `<project-name>` | General service name |
| `nest_starter_db` | `<project_name>_db` | PostgreSQL development database |
| `nest_starter_test_db` | `<project_name>_test_db` | PostgreSQL test database |
| `nest_starter_staging` | `<project_name>_staging` | PostgreSQL staging database |
| `nest-starter-dev` | `<project-name>-dev` | Docker Compose development project namespace |
| `nest-starter-test` | `<project-name>-test` | Docker Compose test project namespace |
| `nest-starter-staging` | `<project-name>-staging` | Docker Compose staging project namespace |
| `nest-starter-prod` | `<project-name>-prod` | Docker Compose production project namespace |
| `starter-dev-` | `<project-name>-dev-` | Container names prefix |
| `starter-test-` | `<project-name>-test-` | Container names prefix |
| `starter-staging-` | `<project-name>-staging-` | Container names prefix |
| `starter-prod-` | `<project-name>-prod-` | Container names prefix |
| `job_name: nest-starter` | `job_name: <project-name>` | Prometheus scrape job configuration |

### Step 4: Package Dependency Synchronization
- Updates package dependencies via `npm run update`.
- Runs `make install` (`npm install --legacy-peer-deps`) to populate `node_modules` with valid locked dependencies.

---

## Starting Development After Generation

Once project generation finishes, navigate into your new project directory:

```bash
cd my-new-project
```

### Option A: Local Development with Docker Backing Services (Recommended)

Start only the external databases and services (PostgreSQL, Redis, MinIO S3, and Prometheus) in Docker containers:

```bash
make dev-deps
```

Then start the NestJS development server on your host machine in watch mode:

```bash
make dev
```

Your API endpoints will be accessible at:
- GraphQL Playground: `http://localhost:3000/graphql`
- Health Checks: `http://localhost:3000/health`
- Prometheus Metrics: `http://localhost:3000/metrics`
- MinIO S3 Console: `http://localhost:9001` (Credentials: `minioadmin` / `minioadmin`)

### Option B: Full Docker Stack

If you want to run every component inside Docker containers, including the NestJS application container behind Nginx reverse proxy:

```bash
make docker-dev-up
```

View application container logs:

```bash
make docker-dev-logs
```

---

## Project Structure Overview

```text
my-new-project/
├── .github/                       # CI/CD workflows for testing and deployment
├── environments/                  # Environment files for each runtime tier
│   ├── .env.development           # Development configuration
│   ├── .env.test                  # Automated testing configuration
│   ├── .env.staging               # Staging configuration
│   └── .env.production            # Production configuration template
├── infrastructure/                # Container configurations
│   └── docker/
│       ├── common/                # Shared Nginx, Prometheus, and MinIO scripts
│       ├── development/           # Development Docker Compose definitions
│       ├── test/                  # Test Docker Compose definitions
│       ├── staging/               # Staging Docker Compose definitions
│       └── production/            # Production Docker Compose definitions
├── src/
│   ├── app.module.ts              # Root NestJS module wiring
│   ├── main.ts                    # Bootstrap entry point (Helmet, CORS, Global Pipes)
│   ├── common/                    # Core cross-cutting infrastructure
│   │   ├── automation/            # Health monitoring and automated probes
│   │   ├── constant/              # Shared enums, roles, and injection tokens
│   │   ├── database/              # TypeORM config, seeders, and repositories
│   │   ├── decorator/             # Parameter decorators (@CurrentUser, @Auth)
│   │   ├── filters/               # GraphQL exception filters
│   │   ├── guards/                # JWT and permission guards
│   │   ├── interceptors/          # Unified GraphQL response envelope formatters
│   │   ├── interfaces/            # Context and entity contract interfaces
│   │   ├── logging/               # Structured logging module
│   │   ├── metrics/               # Prometheus metrics collection and interceptors
│   │   ├── security/              # Password hashing and token provider adapters
│   │   └── translation/           # Localization loader (i18n)
│   └── modules/                   # Domain business modules
│       ├── auth/                  # Authentication, JWT rotation, Google OAuth
│       ├── user/                  # User management, profile updates, caching
│       ├── media/                 # Presigned multipart uploads, S3 storage, BullMQ
│       ├── notification/          # Multi-channel notifications with DLQ
│       ├── payment/               # Multi-provider payment gateway engine
│       └── realtime/              # Clustered WebSockets and heartbeat tracking
├── test/                          # End-to-end integration test suites
├── Makefile                       # Development and lifecycle automation targets
├── package.json                   # Project metadata and dependencies
└── tsconfig.json                  # Strict TypeScript configuration
```

---

## Available Make Commands

The generated project contains a comprehensive `Makefile` to streamline development workflows:

### Lifecycle & Dependencies
- `make install`: Installs dependencies with legacy peer dependency resolution.
- `make update`: Upgrades packages to their latest minor versions and reinstalls.
- `make clean`: Removes `dist/`, `coverage/`, and TypeScript build cache files.

### Development & Execution
- `make dev-deps`: Launches only PostgreSQL, Redis, and MinIO in Docker containers for host development.
- `make dev`: Starts the NestJS application locally in hot-reload watch mode.
- `make build`: Compiles the TypeScript application into the `dist/` directory.
- `make start-prod`: Runs compiled production code with `NODE_ENV=production`.

### Quality & Testing
- `make typecheck`: Runs strict TypeScript type checking without emitting files.
- `make lint`: Performs fast static analysis using oxlint.
- `make format`: Formats code files using Prettier.
- `make test`: Runs unit tests via Vitest.
- `make test-watch`: Runs Vitest in interactive watch mode.
- `make test-cov`: Generates code coverage reports.
- `make test-e2e`: Spins up isolated test containers, executes end-to-end test suites, and tears containers down.

### Database Migrations
- `make typeorm-migration-create`: Creates a blank TypeORM migration file.
- `make typeorm-migration-generate`: Generates an automatic migration based on entity differences.
- `make typeorm-migration-run`: Executes all pending database migrations.
- `make typeorm-migration-revert`: Reverts the most recently executed migration.

### Docker Management
- `make docker-dev-up`: Starts the complete development stack (Nginx, App, DB, Redis, MinIO, Prometheus).
- `make docker-dev-down`: Stops and tears down the development Docker stack.
- `make docker-dev-logs`: Tails the development application container logs.
- `make docker-staging-up`: Starts the staging stack.
- `make docker-prod-up`: Starts the production stack with optimized multi-stage build images.
- `make redis-cli`: Opens an interactive Redis CLI session.
- `make redis-flush`: Flushes all keys in the development Redis database.

---

## License

This package is distributed under the Apache License 2.0. See the `LICENSE` file in the repository root for complete terms.
