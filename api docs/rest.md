# REST & Raw HTTP API

Every endpoint of `@bts-soft/nest-starter` that is served over plain HTTP, next
to the GraphQL API — usable from any HTTP client (curl, Postman, k8s probes)
without a GraphQL client.

GraphQL operations are documented in [`auth.graphql`](./auth.graphql),
[`user.graphql`](./user.graphql) and [`system.graphql`](./system.graphql);
conventions (envelope, errors, RBAC, rate limits) live in
[`README.md`](../README.md).

All examples assume local dev on port **`3000`** (`PORT` env, default 3000).
Behind Nginx the same paths are served on `8082` (staging) / `80` (production).

---

## 1. Endpoint summary

| # | Method | Path | Auth | Response | Purpose |
|---|--------|------|------|----------|---------|
| 1 | `POST` | `/graphql` | per-operation | `application/json` | GraphQL queries & mutations |
| 2 | `GET` | `/graphql` | — | HTML | Playground / Apollo Sandbox (non-production) |
| 3 | `GET` | `/health` | Public | JSON `200` | Liveness + process stats |
| 4 | `GET` | `/health/ready` | Public | JSON `200`/`503` | Readiness (PostgreSQL + Redis) |
| 5 | `GET` | `/metrics` | Public | Prometheus text | Metrics scrape endpoint |
| 6 | `GET` | `/auth/google` | Public | `302` → Google | Start Google OAuth login |
| 7 | `GET` | `/auth/google/callback` | Public | `302` → frontend | OAuth redirect target |

> **Security note:** `/metrics`, `/health*` and the OAuth routes are intentionally
> unauthenticated. Restrict them at the reverse proxy / network level if the
> service is exposed publicly.

### `/api/*` alias

Every path in the table above also works with an `/api` prefix
(`ApiAliasMiddleware`, registered in `main.ts` before Nest routes the request):

| Canonical | Alias |
|-----------|-------|
| `POST /graphql` | `POST /api/graphql` |
| `GET /graphql` | `GET /api/graphql` |
| `GET /health` | `GET /api/health` |
| `GET /health/ready` | `GET /api/health/ready` |
| `GET /metrics` | `GET /api/metrics` |
| `GET /auth/google` | `GET /api/auth/google` |
| `GET /auth/google/callback` | `GET /api/auth/google/callback` |

```bash
curl http://localhost:3000/health          # canonical
curl http://localhost:3000/api/health      # alias — same response
```

### Error shape (REST + GraphQL)

Every error — REST or GraphQL — uses the **same four fields and nothing else**
(no `error` label, no `extensions`, no `locations`, no `stacktrace`):

```json
{
  "success": false,
  "statusCode": 404,
  "message": "Cannot GET /api/nope",
  "timestamp": "2026-10-25T10:15:30.123Z"
}
```

GraphQL wraps the same object in the standard `errors[]` array:

```json
{ "errors": [{ "message": "No Token", "success": false, "statusCode": 401, "timestamp": "…" }], "data": null }
```

Unknown REST paths return the body above with `404` and are logged as a single
**`WARN`** line (`HTTP 404: Cannot GET /path`) without a stack trace — only 5xx
errors are logged as `ERROR` with the stack.

---

## 2. GraphQL over raw HTTP

```bash
# Simple public query
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{ "query": "{ pingApp { success statusCode message timeStamp data } }" }'
```

```bash
# Authenticated mutation (variables + localized message)
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Accept-Language: ar" \
  -d '{
        "query": "mutation($input: LoginInput!) { login(input: $input) { success statusCode message data { accessToken refreshToken } } }",
        "variables": { "input": { "email": "user1@gmail.com", "password": "ni7CV1a5+=2004" } }
      }'
```

### Status codes returned by `/graphql`

| HTTP | When |
|------|------|
| `200` | Request parsed — inspect `errors[]` / `data` in the body |
| `400` | Malformed GraphQL request (bad syntax, unknown field, missing variable) |

Resolver-level failures (401/403/404/429/500) always arrive **inside the body**
as `errors[].statusCode` — see [`README.md` §5](../README.md#5-errors).

### Common headers

```http
Content-Type: application/json
Authorization: Bearer <accessToken>     # authenticated operations
Accept-Language: ar | x-lang: ar         # localized messages (default: en)
```

---

## 3. Google OAuth

### 3.1 Start the flow — `GET /auth/google`

```bash
# Opens the Google consent screen (redirect, scopes: email + profile)
curl -I http://localhost:3000/auth/google
```

Configured by (`environments/.env.*`):

| Variable | Fallback |
|----------|----------|
| `GOOGLE_CLIENT_ID` | `missing` |
| `GOOGLE_CLIENT_SECRET` | `missing` |
| `GOOGLE_CALLBACK_URL` (or `GOOGLE_CALLBACK`) | `http://localhost:3000/auth/google/callback` |
| `FRONTEND_URL` | `http://localhost:5173` |

### 3.2 Finish the flow — `GET /auth/google/callback`

Google redirects here; the server then issues a full token pair and **redirects
to the frontend** with everything in the query string:

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

On failure the redirect carries the reason instead:

```
{FRONTEND_URL}/auth/callback?error=<url-encoded message>
```

Account rules:

- An existing account is matched when **any** of `googleId`, `email` or
  `phoneNumber` matches (single OR lookup); the account is then **linked**
  (`googleId`, phone and avatar are filled in when missing).
- Otherwise a new account is created with role `admin` if it is the very first
  user in the database, otherwise `user`.
- The issued tokens are identical to the ones returned by the `login` mutation
  (24 h access + 7-day rotating refresh), so the same
  `Authorization: Bearer` header works right away.

---

## 4. Liveness — `GET /health`

Always `200` while the process is running. Never touches the database.

```bash
curl http://localhost:3000/health
```

```json
{
  "status": "UP",
  "service": "nest-starter",
  "timestamp": "2026-10-25T10:15:30.123Z",
  "system": {
    "uptime": 1234.567,
    "memory": {
      "heapTotalMemoryMB": 42,
      "heapUsedMemoryMB": 30,
      "rssMB": 80
    },
    "cpuUsage": { "user": 12345678, "system": 8901234 }
  }
}
```

---

## 5. Readiness — `GET /health/ready`

Checks **PostgreSQL** (`SELECT 1`) **and** Redis (`TTL` probe).
`200` when both are `UP`, **`503`** otherwise — this is the probe Kubernetes /
Docker healthchecks should use.

```bash
curl http://localhost:3000/health/ready
```

Healthy:

```json
{
  "status": "UP",
  "timestamp": "2026-10-25T10:15:30.123Z",
  "checks": {
    "database": { "status": "UP" },
    "redis": { "status": "UP" }
  },
  "system": { "uptime": 1234.567, "memory": { "...": "..." } }
}
```

Degraded (`503`):

```json
{
  "status": "DOWN",
  "timestamp": "2026-10-25T10:15:30.123Z",
  "checks": {
    "database": { "status": "UP" },
    "redis": { "status": "DOWN", "message": "ECONNREFUSED 127.0.0.1:6379" }
  },
  "system": { "uptime": 1234.567, "memory": { "...": "..." } }
}
```

---

## 6. Prometheus metrics — `GET /metrics`

```bash
curl http://localhost:3000/metrics
```

- Content type: `text/plain; version=0.0.4; charset=utf-8` (Prometheus scrape
  format), no auth required.
- Includes prom-client **default metrics** (`process_*`, `nodejs_*`, …).

### Custom application metrics

| Metric | Type | Labels | Meaning |
|--------|------|--------|---------|
| `app_requests_total` | Counter | `protocol`, `method`, `path`, `statusCode` | Requests processed |
| `app_request_duration_seconds` | Histogram | `protocol`, `method`, `path`, `statusCode` | Latency (buckets 0.01 … 5 s) |
| `app_errors_total` | Counter | `context`, `errorCode` | Application errors |

Label values:

| Protocol | `method` | `path` |
|----------|----------|--------|
| `HTTP` | HTTP verb (`GET`, `POST`, …) | Route path (`/health`, `/metrics`, …) |
| `GraphQL` | `QUERY` / `MUTATION` | Resolver field name (`login`, `getUsers`, …) |
| `gRPC` | `RPC` | Handler name |

For GraphQL errors the HTTP status label stays `200` (only HTTP requests get a
real status code) and the failure is counted in
`app_errors_total{context="GraphQL:<field>", errorCode="<Code>"}`.

Example scrape config (also present in
`infrastructure/docker/*/prometheus/prometheus.yml`):

```yaml
scrape_configs:
  - job_name: nest-starter
    metrics_path: /metrics
    static_configs:
      - targets: ['app:3000']
```

---

## 7. Rate limiting (GraphQL mutations)

`@RateLimit` (sliding window, keyed by client IP) applies to the auth
mutations only — see [`README.md` §7](../README.md#7-authorization-rbac) for the
per-operation limits.

Successful responses carry:

```http
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 4
X-RateLimit-Reset: 1761500000
```

When exceeded:

- HTTP `429` semantics are reported through GraphQL as
  `errors[0].statusCode = 429`
- message: `Too many requests, please try again later.`
- Introspection queries are exempt (so Playground schema loading still works).

---

## 8. CORS

Enabled from `CORS_ORIGIN` (comma-separated list of origins) with
`credentials: true`. If `CORS_ORIGIN` is unset, cross-origin requests are
**rejected** (`origin: false`).

```env
CORS_ORIGIN=http://localhost:5173,https://app.example.com
```

---

## 9. Container / orchestration probes

| Probe | Endpoint | Expect |
|-------|----------|--------|
| Liveness | `GET /health` | `200` |
| Readiness | `GET /health/ready` | `200` (retry on `503`) |
| Metrics scrape | `GET /metrics` | `200` + Prometheus text |

Docker host ports per environment are listed in the root `README.md`
("Docker Host Ports").
