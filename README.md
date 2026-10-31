# NestJS Production-Ready Starter Template

An enterprise-grade, highly scalable backend starter built with NestJS 12, Node.js 22+, and TypeScript (ESM). Designed with modern architectural patterns, clean separation of concerns, comprehensive test coverage, and out-of-the-box infrastructure stacks.

---

## Key Features

- Framework: NestJS 12 running with Express 5 under native ECMAScript Modules (ESM).
- API Design: Code-first GraphQL powered by Apollo Server with automatic schema generation, unified response envelopes, and REST webhook endpoints.
- Database and ORM: PostgreSQL managed via TypeORM with migrations, seeders, and soft deletes.
- In-Memory Layer: Redis for caching, distributed session storage, token blacklisting, and rate limiting.
- Authentication and Authorization: JWT-based authentication with refresh token rotation, token blacklisting, Google OAuth 2.0, and granular Role-Based Access Control (RBAC).
- Realtime Communications: WebSocket gateway backed by Redis pub/sub and Redis adapter for clustering.
- Notification Engine: Multi-channel delivery support (Database, Email via Nodemailer, SMS via Twilio, and Push Notifications via Firebase Cloud Messaging).
- Payment Integration: Multi-provider payment gateway supporting Stripe, PayPal, Paymob, and Fawry Pay, including Webhook signature verification, transaction verification, and refunds.
- Security and Resilience: Sliding-window rate limiting, Helmet HTTP security headers, CORS management, sensitive field redacting, and strict request validation with class-validator.
- Observability: Prometheus metrics collection, Grafana-ready metric endpoints, health probes (Liveness / Readiness), and structured logging with request trace IDs.
- Internationalization: Multi-language support (English and Arabic) via nestjs-i18n.
- Development Stacks: Isolated Docker Compose configurations for Development, Test, Staging, and Production environments.

---

## Architecture Overview

```
src/
├── app.module.ts              # Root application module wiring core providers
├── main.ts                    # Bootstrap entrypoint configuring security & middleware
├── common/                    # Shared reusable cross-cutting components
│   ├── constant/              # System enums, roles, and permission maps
│   ├── decorator/             # Parameter decorators (@CurrentUser, @Auth, @Public)
│   ├── filter/                # Global exception filter with internationalized errors
│   ├── guard/                 # JWT Auth guard and RBAC Permission guard
│   ├── interceptor/           # Response transform and logging interceptors
│   ├── logging/               # Structured logger with redaction and trace IDs
│   ├── middleware/            # Security headers and correlation ID propagation
│   └── plugins/               # Apollo GraphQL plugins (logging, error formatting)
└── modules/                   # Feature domain modules
    ├── auth/                  # Authentication, JWT rotation, Google OAuth
    ├── user/                  # User accounts, profiles, and password management
    ├── payment/               # Multi-provider payment engine & webhooks
    ├── notification/          # Multi-channel notification dispatchers
    └── realtime/              # WebSocket gateways and cluster sync
```

---

## Prerequisites

- Node.js >= 22.0.0
- npm >= 10.0.0
- Docker and Docker Compose

---

## Getting Started

### 1. Clone the repository and install dependencies

```bash
git clone <repository-url>
cd nest-starter
npm install
```

### 2. Configure Environment Variables

The project uses environment-specific files in the `environments/` directory:
- `environments/.env.development`
- `environments/.env.test`
- `environments/.env.staging`
- `environments/.env.production`

Review `environments/.env.development` and configure your credentials. To override variables locally without committing secrets to Git, create a local override file:

```bash
cp environments/.env.development environments/.env.development.local
```

### 3. Start Supporting Infrastructure

Start PostgreSQL, Redis, and required services using Docker Compose:

```bash
# Start development infrastructure
make docker-dev-up

# Alternatively, using docker compose directly:
docker compose --env-file environments/.env.development -f infrastructure/docker/development/docker-compose.yml up -d
```

### 4. Run Database Migrations

```bash
npm run typeorm:migration:run
```

### 5. Launch the Application

```bash
# Development mode with hot-reload
npm run start:dev

# Production build and run
npm run build
npm run start:prod
```

Once started:
- GraphQL Playground / Sandbox: `http://localhost:3000/graphql`
- Health Check: `http://localhost:3000/health`
- Prometheus Metrics: `http://localhost:3000/metrics`

---

## Payment Gateway Module

The payment module (`src/modules/payment`) provides a standardized interface across four major payment gateways:

| Provider | Type | Capabilities |
| :--- | :--- | :--- |
| Stripe | International Cards / Wallets | Checkout sessions, Webhooks, Refunds |
| PayPal | International Wallets / Cards | Order creation, Capture, Webhooks, Refunds |
| Paymob | Middle East Cards / Wallets / ValU | Payment keys, iFrame checkout, HMAC Webhooks, Refunds |
| Fawry Pay | Egyptian Kiosk Cash / Cards | Reference number generation, Webhooks, Status Inquiry, Refunds |

### GraphQL Payment Operations

Full operational queries and mutations are documented in `api docs/payment.graphql`.

#### Example: Initiate Payment

```graphql
mutation InitiatePayment {
  initiatePayment(
    input: {
      amount: 150.00
      currency: USD
      provider: STRIPE
      customer: {
        name: "John Doe"
        email: "john@example.com"
      }
      returnUrl: "https://yourfrontend.com/payment/success"
      cancelUrl: "https://yourfrontend.com/payment/cancel"
    }
  ) {
    statusCode
    message
    success
    data {
      transactionId
      status
      providerTransactionId
      checkoutUrl
      referenceNumber
    }
  }
}
```

#### Example: Verify Payment Status

```graphql
mutation VerifyPayment {
  verifyPayment(transactionId: "<TRANSACTION_ID>") {
    statusCode
    message
    data {
      id
      status
      provider
    }
  }
}
```

#### Example: Refund Payment (Requires Admin)

```graphql
mutation RefundPayment {
  refundPayment(
    input: {
      transactionId: "<TRANSACTION_ID>"
      amount: 50.00
      reason: "Customer request"
    }
  ) {
    statusCode
    message
    data {
      id
      status
    }
  }
}
```

### Webhook Endpoints

All webhook endpoints consume raw payloads and verify gateway signatures:
- `POST /api/webhooks/payment/stripe`
- `POST /api/webhooks/payment/paypal`
- `POST /api/webhooks/payment/paymob`
- `POST /api/webhooks/payment/fawry`

---

## Authentication and Role-Based Access Control (RBAC)

Access control is enforced declaratively using the `@Auth(...)` decorator:

- `@Auth([Permission.PAYMENT_INITIATE])`: Available to authenticated users (`Role.USER`, `Role.ADMIN`).
- `@Auth([Permission.PAYMENT_MANAGE])`: Restricted to administrative users (`Role.ADMIN`).
- `@Public()`: Bypasses authentication for public endpoints (e.g., login, register, webhooks).

---

## Testing

The project uses Vitest for unit and end-to-end (E2E) testing.

```bash
# Run unit tests
npm test

# Run unit tests with coverage
npm run test:cov

# Run E2E tests (automatically provisions test docker containers)
npm run test:e2e
```

---

## Code Quality and Scripts

- `npm run lint`: Fast linting using oxlint.
- `npm run typecheck`: TypeScript validation without emitting files.
- `npm run format`: Code formatting via Prettier.
- `npm run clean`: Cleans build artifacts and caches.

---

## License

This project is licensed under the Apache-2.0 License.

