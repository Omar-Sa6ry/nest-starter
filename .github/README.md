# GitHub Workflows and Maintenance Architecture

This directory contains the GitHub Actions workflows, issue templates, and automated dependency maintenance configuration for the NestJS Starter template.

All workflows follow standardized continuous integration, security auditing, multi-architecture containerization, and deployment dispatch practices.

---

## Directory Contents

| Path | Purpose |
| :--- | :--- |
| `workflows/` | Continuous integration, delivery, security scanning, health monitoring, and release automation workflows |
| `ISSUE_TEMPLATE/` | GitHub issue forms (`bug_report.yml`, `feature_request.yml`) for structured bug reporting and feature tracking |
| `dependabot.yml` | Automated dependency monitoring for npm packages (root and CLI), GitHub Actions versions, and Docker base images |
| `README.md` | Comprehensive architectural documentation of GitHub configurations (this file) |

---

## Workflows Reference

### 1. Continuous Integration: `ci.yml`
- **Triggers**:
  - `push` to `main`, `master`, and `develop`
  - `pull_request` targeting `main`, `master`, and `develop`
  - `workflow_dispatch` (Manual trigger with inputs: `run_e2e` [boolean], `node_version` [22 or 24])
- **Concurrency**: Cancels redundant in-flight runs on the same branch or pull request.
- **Jobs**:
  - `code-quality`: Checks code formatting (`prettier --check`), runs Oxlint (`npm run lint`), checks TypeScript types (`npm run typecheck`), and tests the NestJS application build bundle (`npm run build`).
  - `unit-tests`: Executes Vitest unit tests with coverage collection (`npm run test:cov`) on a matrix strategy and uploads coverage artifacts (`actions/upload-artifact@v4`).
  - `e2e-tests`: Runs after `code-quality` and `unit-tests`. Initializes PostgreSQL, Redis, and MinIO test infrastructure via `make docker-test-up`, runs end-to-end tests (`vitest.config.e2e.ts`), and tears down the infrastructure via `make docker-test-down`.

### 2. Production Docker Build & Registry: `docker-publish.yml`
- **Triggers**:
  - `push` of semantic version tags matching `v*.*.*`
  - `push` to the `main` branch
  - `workflow_dispatch` (Manual trigger with inputs: `push_image` [boolean], `image_tag` [string])
- **Permissions**: `contents: read`, `packages: write`.
- **Jobs**:
  - Configures QEMU emulation for multi-architecture builds.
  - Configures Docker Buildx.
  - Logs into GitHub Container Registry (`ghcr.io`).
  - Extracts metadata (branch, PR, semver tags, commit SHA) via `docker/metadata-action@v5`.
  - Builds and caches image layers using GitHub Actions cache (`type=gha`).
  - Pushes images to `ghcr.io/{owner}/{repo}` with release tags.

### 3. Production & Staging Deployment: `deploy.yml`
- **Triggers**:
  - `workflow_dispatch` (Manual trigger with inputs: `target_environment` [production, staging], `dry_run` [boolean])
- **Concurrency**: Grouped per target environment to prevent conflicting parallel deployments.
- **Jobs**:
  - Demonstrates GitHub Actions secret masking (`::add-mask::`) to protect sensitive tokens.
  - Exports dynamic environment timestamps to `$GITHUB_ENV`.
  - Serves as a deployment blueprint for SSH remote server execution (e.g. VPS, Dokku, Coolify) or cloud container services (AWS ECS, Kubernetes, Render).

### 4. Webhook Deployment Listener: `deploy-webhook.yml`
- **Triggers**:
  - `repository_dispatch` (Types: `deploy_trigger`, `webhook_event`)
  - `workflow_dispatch` (Manual trigger with inputs: `environment`, `deploy_notes`)
- **Use Case**: Enables external services (headless CMS, custom webhooks, deployment pipelines, chat bots) to trigger automated deployments using the GitHub REST API.
- **Jobs**:
  - Parses event payloads dynamically (supporting both external webhook payloads and manual dispatch inputs).
  - Emits workflow log groups (`::group::`) and workflow annotations (`::notice title=...::`).
  - Generates deployment metrics in the GitHub Actions step summary (`$GITHUB_STEP_SUMMARY`).

### 5. Comprehensive Security & Vulnerability Scan: `security-scan.yml`
- **Triggers**:
  - `schedule`: Runs automatically every Monday at 02:00 AM UTC (`cron: '0 2 * * 1'`)
  - `push` to `main`
  - `pull_request` targeting `main`
  - `workflow_dispatch` (Manual trigger on demand)
- **Permissions**: `contents: read`, `security-events: write`.
- **Jobs**:
  - `npm-audit`: Scans third-party npm packages for vulnerabilities with an audit threshold (`--audit-level=high`).
  - `codeql-analysis`: Runs GitHub CodeQL static code analysis (SAST) for JavaScript and TypeScript to identify common code security flaws.
  - `trivy-docker-scan`: Builds the local production Dockerfile (`infrastructure/docker/production/Dockerfile`) and runs Aqua Security Trivy container scanner for OS and library CVEs.

### 6. Endpoint Health Monitoring: `health-check.yml`
- **Triggers**:
  - `schedule`: Runs periodically every 6 hours (`cron: '0 */6 * * *'`)
  - `workflow_dispatch` (Manual trigger with input: `target_url`)
- **Jobs**:
  - Probes live server endpoints (`GET /health`) using `curl`.
  - Resolves target URL by priority: Manual input -> GitHub Secret (`APP_URL`) -> fallback default.
  - Automatically handles placeholder domains and reports probe status via workflow annotations and markdown summary logs.

### 7. Automated Releases & Changelog: `release.yml`
- **Triggers**:
  - `push` of tags matching `v*.*.*`
  - `workflow_dispatch` (Manual trigger with input: `tag_name`)
- **Permissions**: `contents: write`.
- **Jobs**:
  - Compiles application artifacts (`npm run build`) and archives the distribution bundle (`dist/`).
  - Generates a GitHub Release draft or published release using `softprops/action-gh-release@v2`.
  - Automatically parses conventional commit history to create an automated changelog.

### 8. Pull Request Quality & Conventional Commits: `pr-lint.yml`
- **Triggers**:
  - `pull_request` events: `opened`, `synchronize`, `reopened`.
- **Jobs**:
  - Enforces Conventional Commits formatting on pull request titles (`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`) using `amannn/action-semantic-pull-request@v5`.
  - Auto-logs PR details and event context using GitHub Script (`actions/github-script@v7`).

### 9. First-Time Contributor Welcome: `welcome.yml`
- **Triggers**:
  - `issues`: `opened`
  - `pull_request_target`: `opened`
- **Jobs**:
  - Greets new contributors automatically on their first issue or pull request with helpful links to contributing guidelines and tests.

### 10. Stale Issue & PR Management: `stale.yml`
- **Triggers**:
  - `schedule`: Runs daily at midnight UTC (`cron: '0 0 * * *'`)
  - `workflow_dispatch`
- **Jobs**:
  - Marks inactive issues and pull requests as stale after 60 days of inactivity.
  - Closes stale items after 7 additional days without activity.
  - Automatically exempts critical labels (`pinned`, `security`, `bug`, `enhancement`, `dependencies`).

### 11. Scaffolding CLI Verification: `test-cli.yml`
- **Triggers**:
  - `push` and `pull_request` on changes inside `create-starter/**`.
  - `workflow_dispatch`
- **Jobs**:
  - Matrix testing on Ubuntu and Windows environments.
  - Validates syntax and execution integrity of `@bts-soft/create-starter` CLI binary.

---

## GitHub Issue Templates

Inside `.github/ISSUE_TEMPLATE/`:
- **`bug_report.yml`**: GitHub Issue Form requiring environment details (OS, Node version, Docker), reproducible steps, expected results, and logs.
- **`feature_request.yml`**: Structured proposal form requiring architectural motivation and suggested implementation details.

---

## Automated Dependency Updates (Dependabot)

Configured inside `.github/dependabot.yml`:
- **Root npm dependencies**: Weekly checks on Monday at 03:00 UTC. Automatically groups `@nestjs/*`, `@apollo/*`, and `@types/*` into grouped pull requests to avoid notification noise.
- **CLI tool dependencies**: Weekly checks for `create-starter` dependencies.
- **GitHub Actions**: Monthly checks to update workflow action versions to the latest releases.
- **Dockerfiles**: Monthly checks for base image security updates.

---

## Workflow Commands and Best Practices Reference

All workflows implement modern GitHub Actions runtime features:
- **Grouping**: `echo "::group::Title"` and `echo "::endgroup::"` to collapse verbose build steps in the UI.
- **Notices and Warnings**: `echo "::notice title=Title::Message"` and `echo "::warning title=Title::Message"` for annotations.
- **Secret Masking**: `echo "::add-mask::value"` to prevent exposing dynamic tokens.
- **Dynamic Variables**: Writing to `$GITHUB_OUTPUT` for inter-step parameters and `$GITHUB_ENV` for environment variables.
- **Job Summaries**: Appending markdown data to `$GITHUB_STEP_SUMMARY` to provide visual dashboards on run completion.
