# NestJS Production-Ready Starter Template

An enterprise-grade, highly scalable backend starter built with NestJS 12, Node.js 22+, and TypeScript under native ECMAScript Modules (ESM). Engineered with clean architecture, robust security defaults, asynchronous queue processing, multi-channel notifications, a unified payments engine, S3/MinIO media processing, and isolated Docker Compose stacks for every development tier.

---

## Architectural Highlights

- **Framework**: NestJS 12 running with Express 5 under native ECMAScript Modules (Node.js ESM).
- **API Protocol**: Code-first GraphQL powered by Apollo Server with automatic schema generation, unified response envelopes, and secure REST webhook receivers.
- **Relational Persistence**: PostgreSQL managed via TypeORM with automated migrations, seeders, soft deletes, and indexing.
- **Caching & State**: Redis layer for high-throughput caching, token blacklists, session storage, and rate limiting.
- **Identity & Authorization**: JWT authentication with refresh token rotation, Google OAuth 2.0, and granular Role-Based Access Control (RBAC).
- **Media Storage & Pipeline**: Amazon S3 / MinIO object storage with presigned multipart URLs, direct-to-cloud browser uploads, BullMQ background processing, and thumbnail/metadata generation.
- **Realtime Infrastructure**: Socket.IO WebSocket gateway with `@socket.io/redis-adapter` for transparent horizontal scaling across cluster nodes.
- **Notification Engine**: Decoupled multi-channel dispatcher supporting Database persistence, Email (Nodemailer), SMS (Twilio), and Push Notifications (Firebase Admin).
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
├── main.ts                    # Bootstrap entrypoint configuring Helmet, CORS, and filters
├── common/                    # Reusable cross-cutting infrastructure
│   ├── constant/              # Global enums, application roles, and permissions
│   ├── decorator/             # Parameter decorators (@CurrentUser, @Auth, @Public)
│   ├── filter/                # Global exception filter with localized error envelopes
│   ├── guard/                 # JWT Authentication and RBAC Permission guards
│   ├── interceptor/           # Response serialization, timing, and logging interceptors
│   ├── logging/               # Winston/Pino structured logging with field redaction
│   ├── middleware/            # Correlation ID generator and request trace propagation
│   └── plugins/               # Apollo Server plugins for query logging and error mapping
└── modules/                   # Domain feature modules
    ├── auth/                  # Authentication, JWT rotation, and Google OAuth 2.0
    ├── user/                  # User accounts, profiles, credentials, and relations
    ├── media/                 # S3/MinIO presigned uploads, BullMQ jobs, and metadata
    ├── notification/          # Multi-channel notification dispatchers
    ├── payment/               # Multi-provider payment gateway and webhook handlers
    └── realtime/              # WebSocket gateways, room management, and cluster sync
```

---

## Prerequisites

- **Node.js**: `>= 22.0.0`
- **npm**: `>= 10.0.0`
- **Docker & Docker Compose**: Required for containerized databases, Redis, MinIO, and Prometheus
- **make** (GNU Make) or **task** (Taskfile): Recommended for executing build and lifecycle automation

---

## Quick Start Guide

### 1. Initialize with CLI or Clone

To generate a new project with all branding customized:

```bash
npm create @bts-soft/starter my-app
cd my-app
```

Or clone the repository directly:

```bash
git clone https://github.com/Omar-Sa6ry/nest-starter.git my-app
cd my-app
make install
```

### 2. Configure Environment Variables

The project manages isolated configurations inside the `environments/` directory:

- `environments/.env.development`
- `environments/.env.test`
- `environments/.env.staging`
- `environments/.env.production`

Review `environments/.env.development`. For local overrides without committing sensitive secrets to source control, create a `.local` override file:

```bash
cp environments/.env.development environments/.env.development.local
```

### 3. Spin Up Supporting Infrastructure

Launch PostgreSQL, Redis, MinIO S3, and Prometheus in Docker:

```bash
make docker-dev-up
```

Alternatively, if you use `task`:

```bash
task docker:dev:up
```

### 4. Run Database Migrations

Apply database schema migrations to the PostgreSQL database:

```bash
npm run typeorm:migration:run
```

### 5. Start the Application

```bash
# Start backend in development watch mode
make dev

# Or with npm directly
npm run start:dev
```

Once running, access the service endpoints:

- **GraphQL Playground**: `http://localhost:3000/graphql`
- **Liveness Probe**: `http://localhost:3000/health`
- **Readiness Probe**: `http://localhost:3000/health/ready`
- **Prometheus Metrics**: `http://localhost:3000/metrics`
- **MinIO S3 Console**: `http://localhost:9001` (Credentials: `minioadmin` / `minioadmin`)

---

## Feature Modules

### 1. Media & Storage Subsystem (`src/modules/media`)

Handles large file uploads and media processing with zero application server memory pressure:

- **Direct-to-S3 Presigned Uploads**: The client initiates an upload session via `createUploadSession` and receives presigned URLs to stream chunks directly to Amazon S3 or local MinIO.
- **Multipart Chunk Management**: Supports large binary files with multi-part progress tracking and resumable recovery.
- **Asynchronous Processing**: Once `completeUpload` is called, jobs are enqueued to a BullMQ worker queue for validation, mime-type verification, metadata extraction, and thumbnail generation.
- **Realtime Status Updates**: Workers broadcast processing status (`PROCESSING_PROGRESS`, `READY`, `FAILED`) to connected clients via Socket.IO.
- **Test Lab Frontend**: Includes an integrated React application in `media-frontend/` for end-to-end upload and download testing.

### 2. Unified Payment Gateway (`src/modules/payment`)

Provides an agnostic interface abstracting international and regional payment providers:

| Provider | Integration Type | Features Supported |
| :--- | :--- | :--- |
| **Stripe** | International Cards / Wallets | Hosted checkout sessions, Webhook verification, Refunds |
| **PayPal** | International Wallets / Cards | Order creation, Capture workflow, Webhooks, Refunds |
| **Paymob** | Middle East Cards / Wallets / ValU | Payment keys, iFrame checkout, HMAC signature validation |
| **Fawry Pay** | Egypt Reference Code / Cash | Reference number generation, Status inquiry, Webhook callback |

Raw webhook endpoints with cryptographic signature verification:
- `POST /api/webhooks/payment/stripe`
- `POST /api/webhooks/payment/paypal`
- `POST /api/webhooks/payment/paymob`
- `POST /api/webhooks/payment/fawry`

### 3. Authentication & RBAC (`src/modules/auth`)

Security is declared declaratively across resolvers and controllers:

```typescript
// Public endpoint
@Public()
@Mutation(() => AuthResponse)
login(@Args('input') input: LoginInput) { ... }

// Authenticated user endpoint
@Auth([Permission.USER_READ])
@Query(() => User)
me(@CurrentUser() user: JwtPayload) { ... }

// Administrative endpoint
@Auth([Permission.PAYMENT_MANAGE])
@Mutation(() => PaymentResponse)
refundPayment(@Args('input') input: RefundInput) { ... }
```

---

## Testing & Quality Assurance

```bash
# Run unit tests with Vitest
make test

# Run unit tests in interactive watch mode
make test-watch

# Run unit tests with V8 code coverage report
make test-cov

# Run End-to-End (E2E) tests with automated Docker test container lifecycle
make test-e2e

# Run Oxlint for high-speed linting
make lint

# Run Prettier code formatting
make format

# Type-check TypeScript codebase
npm run typecheck
```

---

## Full Automation Matrix (Makefile & Taskfile)

Both `Makefile` and `Taskfile.yml` provide unified targets:

| Command | Description |
| :--- | :--- |
| `make install` | Install npm packages |
| `make dev` | Start backend in development watch mode |
| `make build` | Build production bundle via Nest CLI |
| `make clean` | Clean `dist/`, `coverage/`, and build info cache |
| `make start-prod` | Run compiled production bundle with `NODE_ENV=production` |
| `make health` | Check HTTP liveness probe via curl |
| `make health-ready` | Check database and Redis readiness probe |
| `make metrics` | Inspect Prometheus metrics output |
| `make docker-dev-up` | Build and start complete development stack in background |
| `make docker-dev-down` | Stop and remove development containers |
| `make docker-dev-logs` | Follow development app logs |
| `make docker-dev-rebuild` | Force rebuild development app container |
| `make docker-test-up` | Start test containers (PostgreSQL & Redis) |
| `make docker-test-down` | Stop and destroy test containers |
| `make docker-staging-up` | Launch staging stack (Nginx, App, DB, Redis, Monitoring) |
| `make docker-staging-down` | Stop staging stack |
| `make docker-prod-up` | Launch production stack |
| `make docker-prod-down` | Stop production stack |
| `make db-up` / `db-down` | Start or stop development PostgreSQL only |
| `make redis-up` / `redis-down` | Start or stop development Redis only |
| `make minio-up` / `minio-down` | Start or stop development MinIO S3 object storage |
| `make down` | Stop all Docker containers across all environments |

---

## License

This project is licensed under the [Apache-2.0 License](https://opensource.org/licenses/Apache-2.0).

