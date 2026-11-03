# @bts-soft/create-starter

CLI template generator for the production-ready NestJS 12 enterprise starter template (`Omar-Sa6ry/nest-starter`).

---

## Overview

`@bts-soft/create-starter` provides a zero-configuration command line interface to clone, rebrand, and initialize a production-grade NestJS backend. It automates repetitive setup chores:

- Clones the official starter repository directly from GitHub via `degit`.
- Automatically strips internal scaffolding directories (`create-starter/` and `media-frontend/`).
- Performs recursive multi-file string replacements customizing project name, package name, database names, and service identifiers.
- Executes dependency installation (`make install`) automatically.
- Provides immediate actionable next steps for launching Docker development services and starting the app.

---

## Prerequisites

Ensure your host system meets the following requirements:

- **Node.js**: `>= 22.0.0`
- **npm**: `>= 10.0.0`
- **make**: GNU Make (optional if invoking npm/docker commands manually)
- **Docker & Docker Compose**: Required for running the database, cache, and object storage stacks

---

## Quick Start

### 1. Generate a New Project

Execute the generator using `npm create`:

```bash
npm create @bts-soft/starter my-service
```

Alternatively, if you run the command without an argument, an interactive prompt will ask for the target project name:

```bash
npm create @bts-soft/starter
```

### 2. What Happens Automatically

During initialization, `@bts-soft/create-starter` performs the following sequence:

1. Downloads the repository snapshot from `Omar-Sa6ry/nest-starter#main` (or `#master`).
2. Cleans up development scaffolding directories:
   - Removes `create-starter/`
   - Removes `media-frontend/`
3. Customizes service configurations:
   - Renames package name in `package.json` to your project name.
   - Adjusts TypeORM database names (e.g. `my_service_db`, `my_service_test_db`, `my_service_staging`).
   - Updates alert manager, Prometheus job names, and Docker container identifiers.
4. Automatically installs npm dependencies by executing `make install` (`npm install`).

### 3. Next Steps

Navigate to your newly generated project folder:

```bash
cd my-service
```

Start the local backing services (PostgreSQL, Redis, MinIO S3, Prometheus):

```bash
make docker-dev-up
```

Start the application in development watch mode:

```bash
make dev
```

---

## Target Project Architecture

The generated project is pre-configured with:

- **NestJS 12**: Fastify/Express under native ECMAScript Modules (ESM).
- **GraphQL**: Code-first schema generation with Apollo Server.
- **Relational Storage**: TypeORM + PostgreSQL with migrations, soft deletes, and seeders.
- **In-Memory Caching & State**: Redis cache manager, token blacklist, and distributed session storage.
- **Security & RBAC**: JWT access/refresh token rotation, Google OAuth 2.0, Helmet, CORS, and permission decorators.
- **Media & File Processing**: S3/MinIO compatible presigned upload sessions, multipart uploads, and BullMQ worker queue processing.
- **Realtime Gateway**: Socket.IO gateway with Redis adapter support for horizontal clustering.
- **Multi-Channel Notifications**: Email (Nodemailer), SMS (Twilio), and Push Notifications (Firebase Admin).
- **Payments Engine**: Unified gateway for Stripe, PayPal, Paymob, and Fawry Pay with automated webhook verification.
- **Observability**: Prometheus metrics (`/metrics`), health probes (`/health`, `/health/ready`), and structured Winston/Pino logging with trace correlation.
- **Docker Compose Stacks**: Dedicated compose environments for development, test, staging, and production.

---

## Publishing & Maintenance

To release a new version of this CLI tool:

1. Update the version number in `package.json`:
   ```bash
   npm version patch
   ```
2. Commit and push the changes to GitHub.
3. Authenticate and publish the package to the public npm registry:
   ```bash
   npm publish --access public
   ```

---

## License

This package is licensed under the [Apache-2.0 License](https://opensource.org/licenses/Apache-2.0).
