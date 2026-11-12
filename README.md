# NestJS Production-Ready Enterprise Starter Template

An enterprise-grade, highly scalable backend starter built with NestJS 12, Node.js 22+, Express 5, and TypeScript under native ECMAScript Modules (ESM). Engineered with clean architecture, robust security defaults, asynchronous queue processing, multi-channel notifications, a unified payments engine, S3/MinIO media processing, and isolated Docker Compose stacks for every development tier.

---

## Architectural Highlights

- **Framework Runtime**: NestJS 12 executed on Node.js 22+ with Express 5 under native ECMAScript Modules (ESM).
- **API Protocol**: Code-first GraphQL powered by Apollo Server with automatic schema generation, unified response envelopes, and secure REST webhook endpoints.
- **Relational Persistence**: PostgreSQL managed via TypeORM with automated migrations, seeders, soft deletes, and composite indexing.
- **Caching & State**: Redis layer for high-throughput caching, token blacklists, session storage, and rate limiting.
- **Identity & Authorization**: JWT authentication with refresh token rotation, Google OAuth 2.0, and granular Role-Based Access Control (RBAC).
- **Media Storage & Pipeline**: Amazon S3 / MinIO object storage with presigned multipart URLs, direct-to-cloud browser uploads, BullMQ background processing, and thumbnail/metadata generation.
- **Realtime Infrastructure**: Socket.IO WebSocket gateway with `@socket.io/redis-adapter` for transparent horizontal scaling across cluster nodes.
- **Notification Engine**: Decoupled multi-channel dispatcher supporting Database persistence, Email (Nodemailer), SMS (Twilio), and Push Notifications (Firebase Admin).
- **Dead Letter Queue (DLQ)**: BullMQ DLQ subsystem with GraphQL diagnostics, job inspection, manual replay, and bulk purge.
- **Payment Processing**: Unified gateway supporting Stripe, PayPal, Paymob, and Fawry Pay with automated webhook signature validation, transaction inquiry, and refunds.
- **Resilience & Security**: Sliding-window rate limiting, Helmet HTTP security headers, CORS protection, sensitive data redaction, and strict DTO validation.
- **Observability**: Prometheus metrics (`/metrics`), health probes (`/health`, `/health/ready`), and structured JSON logging with distributed correlation trace IDs.
- **Internationalization**: Dual-language support (English and Arabic) via `nestjs-i18n`.
- **Infrastructure Automation**: Docker Compose configurations for Development, Test, Staging, and Production environments, orchestrated via `make` or `task`.

---

## Codebase Structure

```text
src/
├── app.module.ts              # Root NestJS module wiring core configuration & providers
├── app.resolver.ts            # Root application resolver (health ping, schema check)
├── main.ts                    # Bootstrap entrypoint configuring Helmet, CORS, and filters
├── common/                    # Reusable cross-cutting infrastructure
│   ├── automation/            # Health indicators and automated status probes
│   ├── constant/              # Global enums, application roles, and permissions
│   ├── database/              # TypeORM config, seeders, and repositories
│   ├── decorator/             # Parameter decorators (@CurrentUser, @Auth, @Public)
│   ├── filters/               # Global exception filter with localized error envelopes
│   ├── graphql/               # General response generic wrappers and error formatters
│   ├── guards/                # JWT Authentication and RBAC Permission guards
│   ├── interceptors/          # Response serialization, timing, and metrics interceptors
│   ├── interfaces/            # Context, authenticated user, and response contracts
│   ├── logging/               # Structured logging with field redaction
│   ├── metrics/               # Prometheus metrics collection and interceptors
│   ├── security/              # Password hashing and token provider adapters
│   └── translation/           # Localization loader (i18n)
└── modules/                   # Domain feature modules
    ├── auth/                  # Authentication, JWT rotation, and Google OAuth 2.0
    ├── user/                  # User accounts, profiles, credentials, and relations
    ├── media/                 # S3/MinIO presigned uploads, BullMQ jobs, and metadata
    ├── notification/          # Multi-channel notification dispatchers and DLQ management
    ├── payment/               # Multi-provider payment gateway and webhook handlers
    └── realtime/              # WebSocket gateways, room management, and cluster sync
```

---

## Prerequisites

Before starting, verify that your environment satisfies the following requirements:

- **Node.js**: `>= 22.0.0`
- **npm**: `>= 10.0.0`
- **Docker & Docker Compose**: Required for containerized databases, Redis, MinIO, and Prometheus
- **GNU Make**: Recommended for executing build and lifecycle automation targets (available on Linux, macOS, and Windows via Git Bash, MSYS2, or WSL)

---

## Quick Start Guide

### 1. Initialize with CLI or Clone

The recommended way to start is using `@bts-soft/create-starter`. It automatically downloads the template, sanitizes internal starter directories (`create-starter/` and `media-frontend/`), runs `make install`, and rebrands all configurations:

```bash
npm create @bts-soft/starter my-service
cd my-service
make dev-deps   # Spin up backing PostgreSQL, Redis, MinIO in Docker (Recommended)
make dev        # Start the NestJS application in watch mode
```

Or clone the repository directly:

```bash
git clone https://github.com/Omar-Sa6ry/nest-starter.git my-service
cd my-service
# Remove template-only directories if not needed
rm -rf create-starter media-frontend
make install
```

### 2. Configure Environment Variables

The project manages isolated configurations inside the `environments/` directory:

- `environments/.env.development`
- `environments/.env.test`
- `environments/.env.staging`
- `environments/.env.production`

Review `environments/.env.development`. For local host development, verify the database credentials and host bindings:

```dotenv
PORT=3000
NODE_ENV=development
DB_HOST=127.0.0.1
DB_PORT=5433
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
DB_NAME=nest_starter_db
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
JWT_SECRET=dev_jwt_secret_change_me
S3_ENDPOINT=http://127.0.0.1:9000
S3_PUBLIC_ENDPOINT=http://localhost:9000
```

### 3. Spin Up Supporting Infrastructure

#### Option A: Local Development with Docker Backing Services (Recommended)

Launch PostgreSQL, Redis, MinIO S3, and Prometheus in Docker containers without running the application inside Docker:

```bash
make dev-deps
```

Then start the NestJS development server on your host machine in watch mode:

```bash
make dev
```

#### Option B: Full Docker Development Stack

If you prefer to run the entire application stack (including NestJS behind Nginx) inside Docker:

```bash
make docker-dev-up
```

Tail application logs:

```bash
make docker-dev-logs
```

---

## Core Domain Modules

### 1. Authentication & Authorization (`src/modules/auth/`)

- **JWT Token Pair**: Issues a short-lived Access Token (e.g., 15 minutes) and a long-lived Refresh Token (e.g., 7 days).
- **Refresh Token Rotation**: Refresh tokens are single-use. Using a refresh token invalidates it and issues a new pair. If an expired or previously used refresh token is detected, the entire session family is revoked to prevent replay attacks.
- **Session Blacklisting**: Active sessions and revoked tokens are tracked in Redis, enabling immediate token invalidation on logout or security events.
- **RBAC & Permissions**: Enforces permissions at resolver and mutation levels using the `@Auth([Permission.VIEW_USER])` decorator.
- **Google OAuth 2.0**: Built-in OAuth flow verifying Google authorization tokens and automatically provisioning local user records.

### 2. User Management (`src/modules/user/`)

- **Profile Management**: Profile retrieval, password updates, and avatar media assignment.
- **Dual-Tier Caching**: Uses a cache-aside pattern with Redis (`user:<id>`) and automatic cache invalidation on profile updates. Dates stored in Redis are automatically revived into native `Date` objects upon retrieval to guarantee GraphQL schema compliance.
- **Soft Deletion**: Uses TypeORM `@DeleteDateColumn` to retain audit trails while excluding deleted records from queries.

### 3. Media Storage & Background Pipeline (`src/modules/media/`)

- **Direct-to-Cloud Uploads**: Generates S3 presigned PUT URLs for single uploads and presigned part URLs for multipart uploads. File bytes stream directly from the client to S3/MinIO, bypassing the application server.
- **Background Worker**: BullMQ processors validate upload completion, verify file MIME signatures, extract image metadata (width, height, format), and generate responsive variants/thumbnails.
- **Storage Quota Enforcement**: Tracks storage consumption per user in Redis and PostgreSQL to enforce subscription tiers and limits.

### 4. Realtime Gateway (`src/modules/realtime/`)

- **Horizontal Cluster Scaling**: Built on Socket.IO using `@socket.io/redis-adapter`. WebSocket events are transparently published across all running application instances.
- **Heartbeat & Presence**: Tracks connected sockets, tracks active user presence, and automatically cleans up stale connections via periodic background sweeps.
- **Security**: WebSocket connection guards enforce JWT authentication during initial handshake. Rate limiting guards protect against event flooding.

### 5. Multi-Channel Notifications & DLQ (`src/modules/notification/`)

- **Channels Supported**: Email (SMTP / Nodemailer), SMS (Twilio), Push Notifications (Firebase Cloud Messaging), and In-App Notifications (PostgreSQL / WebSockets).
- **Dead Letter Queue (DLQ)**: Notifications that exhaust retry attempts are automatically moved to BullMQ dead-letter queues. Administrators can query DLQ failure stats (`getNotificationDlqStats`), inspect failed payloads (`getNotificationDlqFailedJobs`), replay individual jobs (`replayNotificationDlqJob`), or purge queues (`purgeNotificationDlq`) directly through GraphQL.

### 6. Payment Engine (`src/modules/payment/`)

- **Strategy Pattern Architecture**: Modular payment provider architecture supporting Stripe, PayPal, Paymob, and Fawry Pay under a unified interface.
- **Webhook Handlers**: Validates incoming cryptographic signatures, records idempotent transaction logs in PostgreSQL, and dispatches domain events (`PaymentCompletedEvent`, `PaymentFailedEvent`).

---

## GraphQL API Conventions

### Unified Success Response Envelope

All GraphQL queries and mutations return standardized envelopes defined by `GeneralResponse<T>` and `PaginatedResponse<T>`:

```graphql
type UserResponse {
  success: Boolean!
  statusCode: Int!
  message: String!
  timeStamp: String!
  data: User
}
```

### Unified Error Envelope

Errors are intercepted globally and sanitized by `GraphQLExceptionFilter` and `formatGraphQLError`. Sensitive stack traces and internal database schemas are excluded in production:

```json
{
  "errors": [
    {
      "message": "User not found",
      "success": false,
      "statusCode": 404,
      "timestamp": "2026-11-08T14:14:09.403Z"
    }
  ],
  "data": null
}
```

---

## Observability & Monitoring

### Health Checks
- **Endpoint**: `GET /health` and `GET /health/ready`
- Evaluates PostgreSQL database connectivity, Redis responsiveness, and system memory headroom using `@nestjs/terminus`.

### Prometheus Metrics
- **Endpoint**: `GET /metrics`
- Exposes standard Node.js process metrics (heap usage, event loop lag, CPU utilization) and custom business counters (HTTP request durations, GraphQL query latencies, active WebSocket connections).

### Logging
- Structured JSON logging with correlation IDs (`x-correlation-id`). Every request generates or propagates a unique trace ID logged across all layers.

---

## Makefile Automation Reference

The repository provides a complete `Makefile` covering all common development and operational tasks:

```text
Dependency Management:
  make install                  Install dependencies with legacy peer deps
  make update                   Update dependencies to latest minor versions
  make ncu                      Check for outdated dependencies
  make clean                    Delete dist, coverage, and build caches

Development:
  make dev-deps                 Start PostgreSQL, Redis, MinIO in Docker for local dev
  make dev                      Run the NestJS server in local watch mode
  make build                    Build the TypeScript application to dist/
  make start-prod               Run compiled production build

Testing & Quality:
  make typecheck                Run TypeScript compiler type check without emit
  make lint                     Run oxlint fast linter
  make format                   Format codebase with Prettier
  make test                     Execute unit tests with Vitest
  make test-watch               Execute Vitest in interactive watch mode
  make test-cov                 Generate unit test coverage report
  make test-e2e                 Run end-to-end tests against ephemeral Docker containers

Database Migrations:
  make typeorm-migration-create     Create empty migration file
  make typeorm-migration-generate   Generate migration from entity diff
  make typeorm-migration-run        Apply all pending migrations
  make typeorm-migration-revert     Revert the last applied migration

Docker Stacks:
  make docker-dev-up            Spin up complete development Docker Compose stack
  make docker-dev-down          Stop development Docker Compose stack
  make docker-dev-logs          Follow development application container logs
  make docker-dev-rebuild       Rebuild development application image
  make docker-staging-up        Spin up staging Docker Compose stack
  make docker-prod-up           Spin up production Docker Compose stack
  make redis-cli                Open an interactive redis-cli session
  make redis-flush              Flush all keys in the development Redis instance
```

---

## GitHub Actions & Workflows

This starter template includes production-grade GitHub Actions workflows, issue templates, and automated maintenance located in the `.github/` directory.

### Overview of Workflows

| Workflow | Triggers | Description |
| :--- | :--- | :--- |
| `ci.yml` | `push`, `pull_request`, `workflow_dispatch` | Formats, lints (`oxlint`), typechecks, runs Vitest unit tests with coverage, and executes end-to-end tests against Docker test stack |
| `docker-publish.yml` | Tag `v*.*.*`, `push` to `main`, `workflow_dispatch` | Builds multi-architecture production Docker image and publishes it to GitHub Container Registry (`ghcr.io`) |
| `deploy.yml` | `workflow_dispatch` (Manual with inputs) | Standardized deployment workflow template supporting staging and production targets with dry-run support |
| `deploy-webhook.yml` | `repository_dispatch`, `workflow_dispatch` | External webhook deployment listener triggerable via GitHub REST API or manual execution |
| `security-scan.yml` | Weekly `schedule` (cron), `push`, `pull_request`, `workflow_dispatch` | Multi-layer vulnerability scanning: `npm audit`, CodeQL static analysis (SAST), and Aqua Trivy container scanning |
| `health-check.yml` | `schedule` (every 6h), `workflow_dispatch` | Automated monitoring probe for deployed `/health` endpoints using `curl` with secret fallback |
| `release.yml` | Tag `v*.*.*`, `workflow_dispatch` | Builds distribution bundle and creates automated GitHub Release with conventional changelog |
| `pr-lint.yml` | `pull_request` (`opened`, `synchronize`, `reopened`) | Validates PR titles against Conventional Commits specification (`feat`, `fix`, `chore`, etc.) |
| `welcome.yml` | `issues` (`opened`), `pull_request_target` (`opened`) | Automatically welcomes first-time open-source contributors |
| `stale.yml` | Daily `schedule` (cron), `workflow_dispatch` | Marks and closes inactive issues and pull requests after 60 days of inactivity |
| `test-cli.yml` | `push`, `pull_request` on `create-starter/**`, `workflow_dispatch` | Tests CLI scaffolding script syntax across Linux and Windows runners |

### Repository Health & Automation Files

- **Issue Templates (`.github/ISSUE_TEMPLATE/`)**: Includes YAML issue forms (`bug_report.yml` and `feature_request.yml`) for structured community feedback.
- **Dependabot (`.github/dependabot.yml`)**: Automates weekly/monthly version bumps for npm packages (with grouped updates for `@nestjs`, Apollo, and types), GitHub Actions, and Docker base images.

For full technical details, parameter reference, and workflow commands, see [.github/README.md](.github/README.md).

---

## License

This project is open-source software licensed under the [Apache License 2.0](LICENSE).
