# Nest Starter

A production-ready NestJS 12 starter template for building GraphQL APIs. It ships with authentication (JWT + Google OAuth), role-based authorization, PostgreSQL, Redis, rate limiting, i18n, structured logging, Prometheus metrics, health probes, and four isolated Docker Compose environments (development, test, staging, production) — all wired together and ready to run.

The repository is intended to be used as a **GitHub template**: press "Use this template", clone it, and start building your domain instead of re-implementing infrastructure.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [Quick Start](#3-quick-start)
4. [API Reference](#4-api-reference)
5. [Errors](#5-errors)
6. [Authentication](#6-authentication)
7. [Authorization (RBAC)](#7-authorization-rbac)
8. [Project Structure](#8-project-structure)
9. [Configuration](#9-configuration)
10. [Docker Environments](#10-docker-environments)
11. [Testing](#11-testing)
12. [Observability](#12-observability)
13. [Internationalization](#13-internationalization)
14. [Code Quality and Tooling](#14-code-quality-and-tooling)
15. [Architecture and Design Patterns](#15-architecture-and-design-patterns)
16. [Extending the Starter](#16-extending-the-starter)
17. [Using This Template on GitHub](#17-using-this-template-on-github)
18. [License](#18-license)

---

## 1. Overview

### 1.1 What this is

`@bts-soft/nest-starter` is a batteries-included backend starter. Everything below is already implemented, tested and containerised:

- GraphQL API (Apollo, code-first) with an automatically generated schema.
- Full authentication flow: register, login, refresh-token rotation, logout with token blacklisting, forget/reset password, and Google OAuth 2.0.
- Role-based access control with a type-safe, in-memory permission map.
- PostgreSQL persistence through TypeORM, Redis for sessions, cache and blacklist.
- Sliding-window rate limiting on every sensitive mutation.
- i18n messages (English and Arabic) selected from request headers.
- Structured logging with per-request trace IDs and automatic secret redaction.
- Prometheus metrics, liveness and readiness probes.
- Domain events (`@nestjs/event-emitter`) for side effects that must not block a request.
- Unit tests (Vitest + coverage thresholds) and end-to-end tests running against a real Docker stack.
- `Makefile` and `Taskfile.yml` expose exactly the same commands, plus raw `npm` scripts.

### 1.2 What this is not

- It is not a library and is never published to npm (`"private": true`).
- It does not ship a UI. `FRONTEND_URL` is where the OAuth flow redirects back to.
- Permissions are intentionally hardcoded for zero-latency checks. See [16.4](#164-changing-the-rbac-model) for moving to a DB-backed model.

### 1.3 Requirements

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 22 or newer (`engines` in `package.json`) | Docker images use `node:24-alpine` |
| npm | 10 or newer | `npm ci --legacy-peer-deps` is used inside Docker |
| Docker + Docker Compose | v2 CLI (`docker compose`) | Required for every compose stack and for e2e tests |
| GNU Make **or** Task | any recent | Both wrap the same commands; `npm` scripts exist for everything except compose orchestration |
| PostgreSQL / Redis | 15 / 7 | Only if you run the app outside Docker; otherwise compose provides them |

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | NestJS 12, ESM (`"type": "module"`), `nodenext` module resolution |
| Language | TypeScript 6, `strict` mode |
| API | GraphQL code-first with Apollo Server 5 (`@nestjs/graphql` 14) |
| Database | PostgreSQL 15 + TypeORM |
| Cache / sessions / blacklist | Redis 7 via `@bts-soft/cache` and `RedisModule` from `@bts-soft/core` |
| Job queue | BullMQ (`@nestjs/bullmq`) connected to the same Redis |
| Auth | JWT access token (24 h) + refresh token (7 d) with rotation and blacklisting |
| OAuth | Google OAuth 2.0 via `passport-google-oauth20` |
| Rate limiting | `@RateLimit` decorator from `@bts-soft/core` (sliding-window counter) |
| Validation | `class-validator` + `class-transformer`, `@bts-soft/validation`, i18n-aware validation exception |
| Events | `@nestjs/event-emitter` domain events |
| Notifications | `@bts-soft/notifications` (email channel, optional — SMTP settings may be empty) |
| i18n | `nestjs-i18n` through `TranslationModule` from `@bts-soft/core` (locales `en`, `ar`) |
| Logging | Custom `StructuredLogger` with `AsyncLocalStorage` trace IDs, JSON in production, colored text in dev |
| Metrics | Prometheus via `prom-client` |
| Health | `@nestjs/terminus` dependency present; probes implemented in `AutomationModule` |
| Reverse proxy | Nginx (per-environment config) |
| Monitoring | Prometheus + Alertmanager + a small Go Discord relay |
| Testing | Vitest 5 (unit + coverage) and Vitest + Supertest (e2e) |
| Linting | oxlint — `no-explicit-any` is an error |
| Formatting | Prettier |

First-party packages used everywhere: `@bts-soft/core`, `@bts-soft/common`, `@bts-soft/cache`, `@bts-soft/validation`, `@bts-soft/notifications`.

---

## 3. Quick Start

### 3.1 Where environment files live

All environment variables live in `environments/`:

| File | Selected when `NODE_ENV` is | Consumed by |
|------|------------------------------|-------------|
| `environments/.env.development` | `development` (default) | local dev, dev compose stack |
| `environments/.env.test` | `test` | e2e tests, test compose stack |
| `environments/.env.staging` | `staging` | staging compose stack |
| `environments/.env.production` | `production` | production compose stack |

`CommonModule` picks the file from `NODE_ENV`, so there is **no root `.env` to copy**. Docker Compose reads the same file through `--env-file`, which is exactly why every `make` / `task` compose command carries it.

> The committed files contain placeholders only. Real secrets (`JWT_SECRET`, `POSTGRES_PASSWORD`, Google OAuth credentials, Discord webhook) must be replaced per environment — see [9.3](#93-secret-placeholders).

### 3.2 Option A — local development (recommended for day-to-day work)

```bash
make install            # npm install          (task install)

make db-up              # start PostgreSQL only (task db:up)
make redis-up           # start Redis only      (task redis:up)

make dev                # nest start --watch    (task dev / npm run start:dev)
```

The app listens on `http://localhost:3000`, loads `environments/.env.development` automatically, and connects to PostgreSQL on `127.0.0.1:5433` and Redis on `127.0.0.1:6379`.

### 3.3 Option B — full Docker development stack

```bash
make docker-dev-up      # app + postgres + redis + nginx + prometheus + alertmanager + discord relay
make docker-dev-logs    # tail the app container
```

Nginx is published on `http://localhost:8080` and proxies to the app; set `CORS_ORIGIN=http://localhost:8080` (already the default) if your frontend runs on that origin.

### 3.4 Option C — staging (production build on local ports)

```bash
make docker-staging-up  # Nginx on 8082 + app + PostgreSQL 5436 + Redis 6380 + monitoring
```

### 3.5 Option D — production

```bash
# 1. REQUIRED: replace the placeholders in environments/.env.production
#      POSTGRES_PASSWORD   ->  openssl rand -base64 32
#      JWT_SECRET          ->  openssl rand -hex 32
#      RABBITMQ_PASSWORD   ->  openssl rand -hex 16
#      GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET  -> real OAuth credentials
# 2. Set CORS_ORIGIN to your real API origin(s), comma separated

make docker-prod-up     # Nginx on 80/443 + app + PostgreSQL 5435 + Redis 6381 + monitoring
```

### 3.6 Verify the installation

```bash
curl http://localhost:3000/health          # liveness
curl http://localhost:3000/health/ready    # readiness (PostgreSQL + Redis)
curl http://localhost:3000/metrics         # Prometheus text
```

Or the equivalent make targets: `make health`, `make health-ready`, `make metrics` (override the base URL with `make health APP_URL=http://localhost:8080`).

Open `http://localhost:3000/graphql` for the Playground (available in every environment except production).

### 3.7 First GraphQL call

```bash
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{ "query": "{ pingApp { success statusCode message timeStamp data } }" }'
```

---

## 4. API Reference

Full request/response examples live in [`api docs/`](./api%20docs):

| File | Content |
|------|---------|
| [`api docs/rest.md`](./api%20docs/rest.md) | Every raw HTTP endpoint, cURL examples, probes, CORS, rate-limit headers |
| [`api docs/auth.graphql`](./api%20docs/auth.graphql) | Auth operations |
| [`api docs/user.graphql`](./api%20docs/user.graphql) | User operations |
| [`api docs/system.graphql`](./api%20docs/system.graphql) | Health / metrics / system operations |

### 4.1 HTTP endpoints

| Method | Path | Auth | Response | Purpose |
|--------|------|------|----------|---------|
| `POST` | `/graphql` | per operation | JSON | GraphQL queries and mutations |
| `GET` | `/graphql` | none | HTML | Playground / Apollo Sandbox (non-production only) |
| `GET` | `/health` | none | JSON `200` | Liveness + process stats |
| `GET` | `/health/ready` | none | JSON `200` / `503` | Readiness (PostgreSQL + Redis) |
| `GET` | `/metrics` | none | Prometheus text | Metrics scrape endpoint |
| `GET` | `/auth/google` | none | `302` to Google | Start the Google OAuth login |
| `GET` | `/auth/google/callback` | none | `302` to frontend | OAuth redirect target |

`/health`, `/health/ready`, `/metrics` and the OAuth routes are intentionally unauthenticated. If the service is exposed publicly, restrict them at the reverse proxy or network level.

### 4.2 The `/api/*` alias

`ApiAliasMiddleware` (registered in `main.ts` before Nest routes the request) accepts an `/api` prefix on every path above:

| Canonical | Alias |
|-----------|-------|
| `POST /graphql` | `POST /api/graphql` |
| `GET /health` | `GET /api/health` |
| `GET /health/ready` | `GET /api/health/ready` |
| `GET /metrics` | `GET /api/metrics` |
| `GET /auth/google` | `GET /api/auth/google` |
| `GET /auth/google/callback` | `GET /api/auth/google/callback` |

### 4.3 GraphQL operations

**Public**

| Operation | Type | Notes |
|-----------|------|-------|
| `pingApp` | Query | Cheap liveness check through GraphQL |
| `register` | Mutation | Creates the account and returns the token pair |
| `login` | Mutation | Returns the token pair |
| `refreshToken` | Mutation | Rotates the refresh token |
| `forgetPassword` | Mutation | Emits `password.reset_requested` |
| `resetPassword` | Mutation | Consumes the reset token |

**Authenticated**

| Operation | Required permission |
|-----------|---------------------|
| `logout` | authenticated (any role) |
| `getMyProfile` | authenticated (any role) |
| `updateProfile` | authenticated (any role) |
| `changePassword` | authenticated (any role) |
| `getUser` | `VIEW_USER` |
| `getUsers` | `VIEW_USER` (paginated: `page`, `limit`) |
| `promoteUserToAdmin` | `EDIT_USER_ROLE` |
| `updateUserRole` | `EDIT_USER_ROLE` |
| `toggleUserActive` | `DELETE_USER` |
| `deleteUser` | `DELETE_USER` |

### 4.4 Success envelope

Every mutation and query returns the same shape — fields are never omitted:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Login successful",
  "timeStamp": "2026-10-25T10:15:30.123Z",
  "data": {}
}
```

Note the capital `S` in `timeStamp` on success responses; error objects use lowercase `timestamp` (see [5. Errors](#5-errors)). Pagination adds `data.paginationInfo { totalItems, currentPage, nextPage }` and `data.items []`.

`ResponseFormatter`, `GeneralResponse<T>`, `PaginatedResponse<T>` and `BooleanResponse` in `src/common/graphql/` are the building blocks — always return one of them from a resolver.

### 4.5 Common headers

```http
Content-Type: application/json
Authorization: Bearer <accessToken>     # authenticated operations
Accept-Language: ar                      # or x-lang: ar — localized messages, default en
```

### 4.6 Rate limiting

`@RateLimit` (sliding-window counter, keyed by client IP) is applied to the auth mutations only:

| Mutation | Limit |
|----------|-------|
| `register` | 5 per 60 s |
| `login` | 10 per 60 s |
| `refreshToken` | 10 per 60 s |
| `forgetPassword` | 3 per 60 s |
| `resetPassword` | 3 per 60 s |

Successful responses carry `X-RateLimit-Limit`, `X-RateLimit-Remaining` and `X-RateLimit-Reset`. When the limit is exceeded the client receives `errors[0].statusCode = 429` with the message `Too many requests, please try again later.` Introspection queries are exempt so Playground schema loading keeps working.

### 4.7 CORS

Enabled from `CORS_ORIGIN` (comma-separated origins) with `credentials: true`. If the variable is unset, cross-origin requests are rejected (`origin: false`).

```env
CORS_ORIGIN=http://localhost:5173,https://app.example.com
```

---

## 5. Errors

### 5.1 The contract

Every error — GraphQL resolver error, GraphQL parse/validation error, or plain HTTP error — is flattened to exactly four fields and nothing else:

```json
{
  "success": false,
  "statusCode": 401,
  "message": "No Token",
  "timestamp": "2026-10-25T10:15:30.123Z"
}
```

There is never a top-level `error` label, `extensions`, `locations`, `path` or `stacktrace` in a response.

GraphQL wraps the same object in the standard `errors[]` array:

```json
{
  "errors": [
    {
      "message": "No Token",
      "success": false,
      "statusCode": 401,
      "timestamp": "2026-10-25T10:15:30.123Z"
    }
  ],
  "data": null
}
```

### 5.2 How it is produced

| Piece | File | Responsibility |
|-------|------|----------------|
| Global filter | `src/common/filters/graphql-exception.filter.ts` | Converts any exception into the four-field envelope, for GraphQL and HTTP contexts |
| Apollo formatter | `src/common/graphql/graphql-error.formatter.ts` | Strips `locations`, `path`, `extensions`, `stacktrace` from parse/validation errors |
| Response formatter | `src/common/interceptors/response-formatter.ts` | Joins class-validator field errors into one message |
| Envelope interceptor | `src/common/interceptors/graphql-response.interceptor.ts` | Wraps successful resolver results |
| i18n validation | `src/main.ts` | `ValidationPipe` with `I18nValidationException` so validation messages are translated |

Multiple validation messages are collapsed into a single line, for example `name is required, email is invalid`.

### 5.3 HTTP status codes

| HTTP | When |
|------|------|
| `200` | The request was parsed — inspect `errors[]` / `data` in the body |
| `400` | Malformed GraphQL request (bad syntax, unknown field, missing variable) |
| `401` | Missing, invalid or blacklisted token |
| `403` | Authenticated but role/permission check failed |
| `404` | Unknown REST route or resource |
| `429` | Rate limit exceeded |
| `500` | Unexpected server error |
| `503` | Readiness probe failed (`/health/ready`) |

Resolver-level failures always arrive **inside the body** as `errors[].statusCode`; the HTTP status of `/graphql` stays `200` for well-formed requests.

### 5.4 Error logging

- 4xx responses, including routine route 404s, are logged as a single `WARN` line (`HTTP 404: Cannot GET /path`) without a stack trace.
- 5xx responses and GraphQL exceptions are logged as `ERROR` with the stack trace (never in production output beyond the message).

---

## 6. Authentication

### 6.1 Token model

| Token | Lifetime | Claims | Stored where |
|-------|----------|--------|--------------|
| Access token | 24 h (`3600 * 24`) | `sub`, `userId`, `email`, `role`, `permissions`, `sessionId`, `jti` | Client |
| Refresh token | 7 days (`3600 * 24 * 7`) | `sub`, `userId`, `sessionId`, `type: "refresh"`, `jti` | Client; server keeps only `sha256(refreshToken)` in Redis |

Implementation: `src/common/security/jwt-token.provider.ts` (`TOKEN_PROVIDER`). `JWT_SECRET` is read from the environment and a missing value throws at token-generation time.

### 6.2 Redis key design

Implemented in `src/common/database/repositories/redis-session.repository.ts` (`SESSION_STORE`):

| Key | Value | TTL |
|-----|-------|-----|
| `user:session:{userId}:{sessionId}` | session payload | access-token lifetime |
| `user:refresh:{sha256(token)}` | `{ userId }` | 7 days |
| `token:blacklist:{jti}` | `{ blacklisted: true }` | remaining access-token lifetime |

Helpers: `createSession`, `getSession`, `revokeSession`, `revokeAllUserSessions`, `blacklistToken`, `isTokenBlacklisted`, `storeRefreshToken`, `getUserIdByRefreshToken`, `revokeRefreshToken`.

### 6.3 Flows

**Register** (`register.command.ts`)
1. Validate input and check for an existing account.
2. Hash the password (`PASSWORD_HASHER` / bcrypt) and create the user inside a `dataSource.transaction()`.
3. Generate the token pair, create the Redis session and store the hashed refresh token.
4. Emit `user.registered`.
5. Return `{ user, accessToken, refreshToken }`.

**Login** (`login.command.ts`) — verifies credentials, then the same token/session setup; emits `user.logged_in`.

**Refresh** (`refresh-token.command.ts`)
1. Verify the refresh token signature and `type`.
2. Look up `sha256(refreshToken)` in Redis; a missing entry means the token was already rotated or revoked.
3. Revoke the old refresh token, issue a new pair (rotation) and re-store the new hash.

**Logout** (`logout.command.ts`) — blacklists the access token `jti`, revokes the session and the stored refresh token, then emits `user.logged_out`. The `RoleGuard` rejects any blacklisted `jti` on subsequent requests.

**Forget / reset password** (`forget-password.command.ts`, `reset-password.command.ts`) — issues a hashed, short-lived reset token, emits `password.reset_requested`, and on completion updates the password inside a transaction and emits `password.reset_completed`. Tokens are hashed with `src/modules/auth/utils/hashToken.util.ts`.

### 6.4 Google OAuth 2.0

| Route | Behaviour |
|-------|-----------|
| `GET /auth/google` | Redirects to the Google consent screen (scopes: email, profile) |
| `GET /auth/google/callback` | Exchanges the code, links or creates the account, then redirects to `{FRONTEND_URL}/auth/callback` |

Configuration (all in `environments/.env.*`):

| Variable | Fallback |
|----------|----------|
| `GOOGLE_CLIENT_ID` | `missing` |
| `GOOGLE_CLIENT_SECRET` | `missing` |
| `GOOGLE_CALLBACK_URL` (or `GOOGLE_CALLBACK`) | `http://localhost:3000/auth/google/callback` |
| `FRONTEND_URL` | `http://localhost:5173` |

Success redirect:

```
{FRONTEND_URL}/auth/callback
  ?token=<accessToken>
  &refreshToken=<refreshToken>
  &email=<email>
  &firstName=<firstName>
  &lastName=<lastName>
  &role=<role>
  &id=<userId>
```

Failure redirect: `{FRONTEND_URL}/auth/callback?error=<url-encoded message>`.

Account rules:
- An existing account is matched when **any** of `googleId`, `email` or `phoneNumber` matches (single OR lookup); the account is then linked and missing `googleId`, phone and avatar are filled in.
- Otherwise a new account is created with role `admin` if it is the very first user in the database, otherwise `user`.
- The issued tokens are identical to the `login` mutation output (24 h access + 7-day rotating refresh), so the same `Authorization: Bearer` header works immediately.

Relevant files: `src/modules/auth/oauth/` (`oauth.controller.ts`, `oauth.service.ts`, `strategies/google.strategy.ts`, `interfaces/google.interface.ts`).

### 6.5 Command structure

Auth use cases are expressed as command classes under `src/modules/auth/commands/` (`register`, `login`, `logout`, `refresh-token`, `forget-password`, `reset-password`), each with its own spec file. `AuthService` delegates to them, and `user.factory.ts` centralises `User` entity construction.

---

## 7. Authorization (RBAC)

### 7.1 Roles and permissions

Roles (`src/common/constant/enum.constant.ts`):

| Role | Value |
|------|-------|
| `ADMIN` | `admin` |
| `USER` | `user` |

Permissions: `UPDATE_USER`, `DELETE_USER`, `EDIT_USER_ROLE`, `VIEW_USER`, `RESET_PASSWORD`, `CHANGE_PASSWORD`, `FORGOT_PASSWORD`, `LOGOUT`.

Both enums are registered with `registerEnumType`, so they are usable directly in GraphQL inputs and outputs.

### 7.2 Permission map

`src/common/constant/rolePermissionsMap.constant.ts`:

| Role | Permissions |
|------|------------|
| `ADMIN` | `UPDATE_USER`, `DELETE_USER`, `EDIT_USER_ROLE`, `VIEW_USER`, `RESET_PASSWORD`, `CHANGE_PASSWORD`, `FORGOT_PASSWORD`, `LOGOUT` |
| `USER` | `UPDATE_USER`, `RESET_PASSWORD`, `CHANGE_PASSWORD`, `FORGOT_PASSWORD`, `LOGOUT` |

The map is hardcoded: type-safe, and checked with zero I/O latency.

### 7.3 Enforcing a rule

```typescript
import { Auth } from '../../common/decorator/auth.decorator.js';
import { Permission } from '../../common/constant/enum.constant.js';

@Query(() => UserResponse)
@Auth([Permission.VIEW_USER])      // no argument -> any authenticated user
async getUser(@Args('id') id: string): Promise<UserResponse> { ... }
```

`@Auth(permissions?)` sets the `permissions` metadata and applies `RoleGuard`. The guard:

1. Reads the request from GraphQL or HTTP context (`Adapter` pattern).
2. Extracts `Bearer` from the `Authorization` header; missing token -> `401`.
3. Reads the token `jti` and rejects blacklisted tokens -> `401`.
4. Verifies the signature and expiry; failure or missing `userId` -> `401`.
5. Resolves `payload.role` to permissions via `rolePermissionsMap`.
6. Requires **all** requested permissions (and any requested roles) -> otherwise `403`.
7. Attaches `{ id, email, role, permissions, sessionId }` to `request.user`, which resolvers read through `@CurrentUser()`.

### 7.4 Changing the RBAC model

- **Add a permission**: add the enum value, add it to the roles that should hold it, then reference it in `@Auth([...])`.
- **Add a role**: add the enum value and a `rolePermissionsMap` entry (the map is exhaustive over `Role`, so TypeScript reports a missing key).
- **Runtime-editable permissions**: replace `rolePermissionsMap` with a cached repository lookup. Inject a new provider behind a token (see [16.3](#163-swapping-implementations-through-di-tokens)) so no resolver or guard code changes.

---

## 8. Project Structure

```
.
├── src/
│   ├── main.ts                        # Bootstrap: CORS, /api alias, ValidationPipe, process-level guards
│   ├── app.module.ts                  # Root module: global filter + interceptors
│   ├── app.resolver.ts                # pingApp
│   ├── schema.gql                     # Generated schema (dev/test only, git-ignored)
│   ├── common/
│   │   ├── common.module.ts           # Config, i18n, BullMQ, JWT, GraphQL, Redis, Database, DI tokens
│   │   ├── automation/                # HealthService + HealthController (/health, /health/ready)
│   │   ├── constant/                  # Role/Permission enums, rolePermissionsMap
│   │   ├── database/                  # DatabaseModule, RedisSessionRepository
│   │   ├── decorator/                 # @Auth
│   │   ├── filters/                   # GraphQLExceptionFilter (GraphQL + HTTP)
│   │   ├── graphql/                   # GeneralResponse, BooleanResponse, error formatter
│   │   ├── guard/                     # RoleGuard (JWT + blacklist + RBAC)
│   │   ├── interceptors/              # GraphQLResponseInterceptor, ResponseFormatter
│   │   ├── interfaces/                # Context, JWT payload, pagination, security contracts
│   │   ├── logging/                   # StructuredLogger, LoggerContext (ALS), LoggerMiddleware
│   │   ├── metrics/                   # MetricsService, MetricsController, MetricsInterceptor
│   │   ├── middleware/                # ApiAliasMiddleware (/api/*)
│   │   ├── security/                  # BcryptPasswordHasher, JwtTokenProvider, injection tokens
│   │   └── translation/locales/       # en/, ar/ message catalogs
│   └── modules/
│       ├── auth/
│       │   ├── auth.module.ts, auth.resolver.ts, auth.service.ts
│       │   ├── commands/              # register, login, logout, refresh, forget, reset
│       │   ├── adapters/              # notification.adapter, redis.adapter
│       │   ├── events/                # domain events + DomainEventHandler
│       │   ├── factory/               # UserFactory
│       │   ├── oauth/                 # controller, service, Google strategy
│       │   ├── dtos/, inputs/, interfaces/, utils/
│       └── user/
│           ├── user.module.ts, user.resolver.ts
│           ├── user.service.ts        # cache-aside wrapper (optional cache manager)
│           ├── db-user.service.ts     # all SQL operations
│           ├── entity/user.entity.ts
│           └── dto/, interfaces/
├── test/                              # e2e specs (vitest.config.e2e.ts)
│   ├── app.e2e-spec.ts
│   ├── auth.e2e-spec.ts
│   ├── oauth.e2e-spec.ts
│   └── user.e2e-spec.ts
├── api docs/                          # REST + GraphQL operation documentation
├── environments/                      # .env.development / .env.test / .env.staging / .env.production
├── infrastructure/docker/
│   ├── common/                        # nginx, prometheus, alertmanager, discord-relay (Go)
│   ├── development/                   # Dockerfile + compose (hot reload, bind mount)
│   ├── test/                          # Dockerfile + compose for e2e
│   ├── staging/                       # production-style build, Nginx on 8082
│   └── production/                    # multi-stage build, Nginx on 80/443
├── Makefile                           # GNU Make targets
├── Taskfile.yml                       # go-task targets (same commands, different syntax)
├── nest-cli.json
├── vitest.config.ts                   # unit + coverage thresholds
├── vitest.config.e2e.ts
├── oxlint.json
├── tsconfig.json / tsconfig.build.json
├── LICENSE
└── README.md
```

Co-located `*.spec.ts` files sit next to the code they cover; e2e specs live in `test/`.

---

## 9. Configuration

### 9.1 Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP port | `3000` |
| `NODE_ENV` | Selects the env file and log format | `development` |
| `CORS_ORIGIN` | Allowed origins, comma separated | unset (CORS disabled) |
| `DB_HOST` / `DB_PORT` | PostgreSQL address | `127.0.0.1` / per environment |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` | Database credentials | per environment |
| `DB_NAME` | Database name | per environment |
| `REDIS_HOST` / `REDIS_PORT` | Redis address | `127.0.0.1` / `6379` |
| `JWT_SECRET` | Signing secret for access **and** refresh tokens | required |
| `LOG_LEVEL` | `debug`, `verbose`, `info`, `warn`, `error` | `debug` outside production, `info` in production |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth credentials | placeholder |
| `GOOGLE_CALLBACK_URL` | OAuth redirect URI | `http://localhost:3000/auth/google/callback` |
| `FRONTEND_URL` | Where the OAuth flow redirects back | `http://localhost:5173` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Optional email channel | empty |
| `ALERT_WEBHOOK_URL` | Alertmanager -> Discord relay | `http://alertmanager-discord:8080/webhook` |
| `DISCORD_WEBHOOK_URL` / `DISCORD_USERNAME` | Discord notifications | placeholder |
| `NGINX_HTTP_PORT`, `PROMETHEUS_PORT`, `ALERTMANAGER_PORT`, `ALERTMANAGER_DISCORD_PORT`, `NATS_*`, `RABBITMQ_*` | Host port mapping for compose | see [10.2](#102-host-ports) |

### 9.2 Per-environment port map

| Variable | development | test | staging | production |
|----------|-------------|------|---------|------------|
| `NGINX_HTTP_PORT` | 8080 | – | 8082 | 80 |
| `NGINX_HTTPS_PORT` | – | – | – | 443 |
| `DB_PORT` | 5433 | 5434 | 5436 | 5435 |
| `REDIS_PORT` | 6379 | 6378 | 6380 | 6381 |
| `PROMETHEUS_PORT` | 9090 | – | 9091 | 9092 |
| `ALERTMANAGER_PORT` | 9093 | – | 9094 | 9095 |
| `ALERTMANAGER_DISCORD_PORT` | 8081 | – | 8083 | 8084 |
| `NATS_PORT` / `NATS_MONITOR_PORT` | 4222 / 8222 (service commented out) | – | 4223 / 8223 | internal only |
| `RABBITMQ_PORT` / `RABBITMQ_MANAGEMENT_PORT` | 5672 / 15672 (service commented out) | – | 5673 / 15673 | internal only |

### 9.3 Secret placeholders

The committed environment files intentionally contain **no real secrets**. Before running a real environment, replace:

```bash
openssl rand -base64 32     # POSTGRES_PASSWORD
openssl rand -hex 32        # JWT_SECRET
openssl rand -hex 16        # RABBITMQ_PASSWORD
```

and create real Google OAuth credentials at <https://console.cloud.google.com/apis/credentials> (authorised redirect URI: `{GOOGLE_CALLBACK_URL}`).

`.gitignore` keeps `environments/*` out of version control except the committed `environments/.env.*` templates, and ignores `environments/.env.local*` for machine-specific overrides.

---

## 10. Docker Environments

Four independent stacks, all runnable at the same time on one machine because every host port is unique:

```bash
make docker-dev-up        # development
make docker-test-up       # test (used by npm run test:e2e)
make docker-staging-up    # staging
make docker-prod-up       # production
make down                 # stop all four
```

### 10.1 Services per stack

| Service | development | test | staging | production |
|---------|-------------|------|---------|------------|
| App (NestJS) | yes (bind mount, watch) | yes | yes (production build) | yes (multi-stage build) |
| Nginx | yes | no | yes | yes (+TLS) |
| PostgreSQL 15 | yes | yes | yes | yes |
| Redis 7 | yes | yes | yes | yes |
| Prometheus | yes | no | yes | yes |
| Alertmanager + Discord relay | yes | no | yes | yes |
| NATS (JetStream) | commented out | internal only | yes | internal only |
| RabbitMQ | commented out | internal only | yes | internal only |

Stack names and container prefixes: `nest-starter-dev` / `starter-dev-*`, `starter-test-*`, `starter-staging-*`, `starter-prod-*`.

Development, test, staging and production bind PostgreSQL, Redis and monitoring to `127.0.0.1` only (except the development stack, which publishes on all interfaces as before).

### 10.2 Host ports

See the table in [9.2](#92-per-environment-port-map).

### 10.3 Image and dependency management

```bash
make docker-dev-rebuild   # down, delete the node_modules volume, build --force-recreate app
make docker-dev-logs      # docker compose logs -f app
```

`npm ci --legacy-peer-deps` runs inside the Dockerfiles; the development image mounts the source and keeps `node_modules` in a named volume so host/container platform binaries never mix.

---

## 11. Testing

### 11.1 Unit tests

```bash
make test          # vitest run                (task test / npm run test)
make test-watch    # vitest                    (npm run test:watch)
make test-cov      # vitest run --coverage     (npm run test:cov)
make test-debug    # vitest --inspect-brk      (npm run test:debug)
```

`vitest.config.ts` includes `**/*.spec.ts`, enables globals, resolves TS path aliases through `vite-tsconfig-paths`, and enforces coverage thresholds:

| Metric | Threshold |
|--------|-----------|
| Statements | 85% |
| Branches | 75% |
| Functions | 75% |
| Lines | 90% |

Coverage excludes: spec files, `*.d.ts`, Nest modules/DI wiring, `src/main.ts`, the TypeORM datasource factory, resolvers (covered end-to-end) and type-only files (DTOs, interfaces, entities, enums, constants).

### 11.2 End-to-end tests

```bash
make test-e2e      # npm run test:e2e
```

This runs `make docker-test-up && vitest run --config ./vitest.config.e2e.ts && make docker-test-down`, so it needs Docker and `make` on the machine. The stack uses `environments/.env.test` and isolated containers (`starter-test-postgres`, `starter-test-redis`).

Manual control:

```bash
make docker-test-up
npx vitest run --config ./vitest.config.e2e.ts
make docker-test-down
```

`vitest.config.e2e.ts` includes `**/*.e2e-spec.ts` with `hookTimeout: 180s` and `testTimeout: 30s`.

Specs: `test/app.e2e-spec.ts`, `test/auth.e2e-spec.ts`, `test/oauth.e2e-spec.ts`, `test/user.e2e-spec.ts`.

---

## 12. Observability

### 12.1 Structured logging

`src/common/logging/logger.service.ts` implements Nest's `LoggerService`:

- **Production**: one JSON object per line (`timestamp`, `level`, `context`, `message`, plus the trace store).
- **Development**: colored single-line output with `[TraceID: ...]` and `[Context]`.
- **Trace IDs**: `LoggerContext` (`AsyncLocalStorage`) carries `traceId` through the request; `LoggerMiddleware` seeds it per request.
- **Redaction**: passwords, secrets, tokens, API keys, cookies, `Authorization` headers, JWT-shaped strings and webhook URLs are masked before anything is written.
- **Level filtering**: `LOG_LEVEL` (defaults to `debug` outside production, `info` in production).

### 12.2 Health probes

| Endpoint | Behaviour |
|----------|-----------|
| `GET /health` | Always `200` while the process runs; reports uptime, heap/CPU usage; never touches the database |
| `GET /health/ready` | Checks PostgreSQL (`SELECT 1`) and Redis; `200` when both are `UP`, `503` otherwise |

Docker healthchecks and orchestrator probes should use `/health/ready`; use `/health` for liveness.

### 12.3 Prometheus metrics

`GET /metrics` returns `text/plain; version=0.0.4` with prom-client default metrics (`process_*`, `nodejs_*`) plus:

| Metric | Type | Labels |
|--------|------|--------|
| `app_requests_total` | Counter | `protocol`, `method`, `path`, `statusCode` |
| `app_request_duration_seconds` | Histogram | `protocol`, `method`, `path`, `statusCode` (buckets 0.01 … 5 s) |
| `app_errors_total` | Counter | `context`, `errorCode` |

Label values: `protocol` is `HTTP`, `GraphQL` or `gRPC`; `method` is the HTTP verb or `QUERY` / `MUTATION`; `path` is the route path or the resolver field name. For GraphQL errors the HTTP status label stays `200` and the failure is counted in `app_errors_total{context="GraphQL:<field>"}`.

Scrape config (already present in `infrastructure/docker/*/prometheus/prometheus.yml`):

```yaml
scrape_configs:
  - job_name: nest-starter
    metrics_path: /metrics
    static_configs:
      - targets: ['app:3000']
```

### 12.4 Alerting

Alertmanager is configured from `infrastructure/docker/common/alertmanager/alertmanager.yml.tmpl` and forwards alerts to a tiny Go relay (`infrastructure/docker/common/discord-relay`) which posts them to `DISCORD_WEBHOOK_URL`. Set a real webhook URL to receive alerts; leave it empty to disable forwarding.

---

## 13. Internationalization

- Catalogs: `src/common/translation/locales/en/*.json` and `src/common/translation/locales/ar/*.json` (namespaced per feature: `common`, `user`).
- Loaded by `TranslationModule.forRoot()` from `@bts-soft/core` with `fallbackLanguage: 'en'` and `watch: true` (changes are picked up without a restart).
- Language resolution order: `Accept-Language` header, then `x-lang` header, then `en`. The value is placed on the GraphQL context as `context.language`.
- Resolvers translate with `await this.i18n.t('user.REGISTER_SUCCESS')`.
- Validation errors are translated too: `ValidationPipe` throws `I18nValidationException`, so field messages arrive localized.

```bash
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -H "Accept-Language: ar" \
  -d '{ "query": "{ pingApp { message } }" }'
```

Add a language by creating a folder under `locales/` and translating the same keys; no code changes are required.

---

## 14. Code Quality and Tooling

### 14.1 Commands

| Purpose | Make | Task | npm |
|---------|------|------|-----|
| Install dependencies | `make install` | `task install` | `npm install` |
| Check outdated packages | `make ncu` | `task ncu` | — |
| Update dependencies | `make update` | `task update` | — |
| Lint | `make lint` | `task lint` | `npm run lint` |
| Format | `make format` | `task format` | `npm run format` |
| Build | `make build` | `task build` | `npm run build` |
| Start (watch) | `make dev` / `make start-dev` | `task dev` | `npm run start:dev` |
| Start (debug) | `make start-debug` | `task start:debug` | `npm run start:debug` |
| Start (production build) | `make start-prod` | `task start:prod` | `npm run start:prod` |
| Clean artifacts | `make clean` | `task clean` | `npm run clean` |
| Health / readiness / metrics | `make health`, `make health-ready`, `make metrics` | `task health` … | — |

`make help` and `task --list` print every available target.

> `npm run deploy` (`nest deploy`) is a placeholder for your own deployment schematic — it is not part of the stock Nest CLI. Remove the script and the matching `deploy:` task if you do not install one.

### 14.2 Linting

`oxlint.json` enables:

| Rule | Level |
|------|-------|
| `@typescript-eslint/no-explicit-any` | error — use `unknown` and narrow |
| `@typescript-eslint/no-floating-promises` | warn |

### 14.3 Formatting

`.prettierrc`: `singleQuote: true`, `trailingComma: "all"`. `npm run format` rewrites `src/**` and `test/**`.

### 14.4 TypeScript

`tsconfig.json`: `strict`, `module`/`moduleResolution: nodenext`, `target: ES2023`, decorators enabled (`experimentalDecorators`, `emitDecoratorMetadata`), `isolatedModules`, `declaration`, `types: [vitest/globals, node]`. `tsconfig.build.json` drives `nest build` (output `dist/`, incremental `*.tsbuildinfo`).

ESM note: source files import each other with explicit `.js` extensions — keep that convention.

### 14.5 Repository hygiene

`.gitignore` excludes `dist/`, `node_modules/`, `coverage/`, logs, `*.tsbuildinfo`, `src/schema.gql`, `notes.txt` and local env overrides, while keeping the committed `environments/.env.*` templates. `.dockerignore` keeps host artifacts out of images.

---

## 15. Architecture and Design Patterns

### 15.1 Request pipeline

```
Request
  -> ApiAliasMiddleware            (/api/* -> canonical path)
  -> LoggerMiddleware              (trace ID into AsyncLocalStorage)
  -> GraphQL / HTTP router
  -> interceptors: MetricsInterceptor -> GraphQLResponseInterceptor (envelope)
  -> RoleGuard (@Auth)             (token, blacklist, RBAC)
  -> ValidationPipe                (class-validator, i18n errors)
  -> resolver -> service -> repository
  -> GraphQLExceptionFilter        (four-field error contract)
```

### 15.2 Patterns in use

**Creational**
- Factory Method — `UserFactory.createUser()` centralises user entity construction.
- DI Factory — `useFactory` in `JwtModule`, `BullModule`, `ConfigModule`.
- Singleton — the Nest DI container plus module-level providers.

**Structural**
- Adapter — `RoleGuard` adapts GraphQL and HTTP execution contexts; `MetricsInterceptor` adapts HTTP, GraphQL and gRPC call sites.
- Decorator — `@Auth()` composes metadata + guard; `@RateLimit`, `@CurrentUser` from `@bts-soft/core`.
- Facade — `ResponseFormatter`, `JwtTokenProvider`, `HealthService`.

**Behavioural**
- Strategy — `IPasswordHasher` with `BcryptPasswordHasher`; `ITokenProvider` with `JwtTokenProvider`; `ISessionStore` with `RedisSessionRepository`.
- Template Method — `UserService` defines the cache-aside skeleton (`getCached` -> `findByIdFromDb` -> `setCache`).
- Observer — `@nestjs/event-emitter` domain events (`user.registered`, `user.logged_in`, `user.logged_out`, `password.reset_requested`, `password.reset_completed`) handled by `DomainEventHandler`.
- Chain of Responsibility — middleware -> interceptor -> guard -> pipe -> filter.
- Command — auth use cases in `src/modules/auth/commands/`.

### 15.3 Dependency inversion

Injection tokens live in `src/common/security/tokens/injection.tokens.ts`:

```
PASSWORD_HASHER  -> BcryptPasswordHasher
TOKEN_PROVIDER   -> JwtTokenProvider
SESSION_STORE    -> RedisSessionRepository
```

They are bound once in `CommonModule` with `useExisting`, exported globally, and consumed through `@Inject(TOKEN_PROVIDER)` and friends — so consumers never depend on a concrete class.

---

## 16. Extending the Starter

### 16.1 Add a module

1. `nest g resource product` (or create `src/modules/product/` by hand: `*.module.ts`, `*.resolver.ts`, `*.service.ts`, `entity/`, `dto/`).
2. Return the standard envelope from every resolver (`GeneralResponse` / `BooleanResponse` / `PaginatedResponse`).
3. Protect operations with `@Auth([Permission.X])` and read the caller with `@CurrentUser()`.
4. Register the module in `src/app.module.ts`.
5. Add a `*.spec.ts` next to the service and, if the flow is cross-cutting, an e2e spec in `test/`.
6. Add messages to `src/common/translation/locales/{en,ar}/` and translate them through `I18nService`.
7. Add GraphQL operations to `api docs/`.

### 16.2 Add an entity

1. Create `src/modules/<feature>/entity/<feature>.entity.ts` extending TypeORM's `BaseEntity` if you use the active-record helpers, otherwise keep it a plain `@Entity()` and access it through `DbUserService`-style services.
2. Register the entity in a `TypeOrmModule.forFeature([...])` inside your module — `autoLoadEntities: true` picks it up automatically. Note that `synchronize` is `true` for every environment except production (`DatabaseModule`), so use real migrations for staging and production data changes.
3. Remember that entities are excluded from coverage: logic belongs in services.

### 16.3 Swapping implementations through DI tokens

```typescript
// CommonModule
{ provide: PASSWORD_HASHER, useExisting: ArgonPasswordHasher },
```

No consumer code changes: resolvers and services keep injecting the token.

### 16.4 Changing the RBAC model

Edit `rolePermissionsMap` for a static change; for database-backed permissions introduce a `PermissionService` behind a new token, cache it in Redis, and keep `RoleGuard` as the single enforcement point.

### 16.5 Adding a background consumer

BullMQ is already configured against Redis in `CommonModule`. Add `BullModule.registerQueue({ name: 'mail' })` in your feature module and a `@Processor('mail')` worker class.

---

## 17. Using This Template on GitHub

1. Click **Use this template** -> **Create a new repository**.
2. Clone it and rename the package:
   ```bash
   git clone https://github.com/<you>/<your-project>.git
   cd <your-project>
   npm pkg set name="<your-project>" private=true
   npm install
   ```
3. Replace the environment values:
   - `POSTGRES_PASSWORD`, `JWT_SECRET`, `RABBITMQ_PASSWORD` (see [9.3](#93-secret-placeholders))
   - `CORS_ORIGIN`, `DB_NAME`, `POSTGRES_USER`
   - Google OAuth credentials and `FRONTEND_URL`
4. Rename the compose project and container prefixes if you want to avoid clashes with a running starter stack (`name: nest-starter-dev` and `starter-*-container_name` in each `infrastructure/docker/*/docker-compose.yml`).
5. Health endpoints report `service: "nest-starter"` — update it in `src/common/automation/health.controller.ts`.
6. Delete what you do not need: `api docs/` samples you have replaced, or the monitoring stack if you scrape elsewhere.
7. Sanity check:
   ```bash
   make install
   make lint
   make test
   make test-e2e
   make dev
   ```
8. Turn the repository into a template in GitHub settings (Settings -> "Template repository") so the button appears on the landing page.

Pre-commit checklist: no secrets in `environments/` (they are committed), coverage thresholds green, `npm run lint` clean, `src/schema.gql` regenerated and not committed.

---

## 18. License

Licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE).

You may not use this file except in compliance with the License. A copy is available at <http://www.apache.org/licenses/LICENSE-2.0>.

```
Copyright 2026 Omar Ahmed Sabry (bts-soft)
```
