# Contributing to NestJS Starter

Thank you for your interest in contributing to the NestJS Starter project! We welcome contributions, bug fixes, architecture improvements, and documentation enhancements from the open-source community.

---

## Code of Conduct

By participating in this project, you agree to maintain a respectful, constructive, and inclusive environment for everyone.

---

## Development Setup

### 1. Prerequisites
Ensure you have the following installed locally:
- **Node.js**: `>= 22.0.0`
- **npm**: `>= 10.0.0`
- **Docker & Docker Compose**: Required for running databases and test stacks.
- **GNU Make** (or `task` via Taskfile): For lifecycle and automation commands.

### 2. Getting Started
Clone the repository and set up your local environment:
```bash
git clone https://github.com/Omar-Sa6ry/nest-starter.git
cd nest-starter

# Install dependencies
make install

# Start local backing infrastructure (PostgreSQL, Redis, MinIO)
make dev-deps

# Start application in development watch mode
make dev
```

---

## Quality Standards & Verification

Before submitting any Pull Request, verify that all quality checks and test suites pass locally. We provide a single command that runs the full verification pipeline:

```bash
make check-all
```

`make check-all` executes:
1. **Linter**: `make lint` (`oxlint`)
2. **Type Check**: `make typecheck` (`tsc --noEmit`)
3. **Unit Tests & Coverage**: `make test-cov` (`vitest run --coverage`)
4. **End-to-End Tests**: `make test-e2e` (spins up Docker containers, runs Vitest E2E suite, and cleans up)

For quick iterative checks during development, you can run:
```bash
make check
```

---

## Commit Message Guidelines (Conventional Commits)

We enforce the [Conventional Commits](https://www.conventionalcommits.org/) specification for all commit messages and pull request titles. This ensures automated changelog generation and semantic versioning.

### Format
```text
<type>(<scope>): <short description>
```

### Allowed Types
- **`feat`**: A new feature or capability
- **`fix`**: A bug fix
- **`docs`**: Documentation updates or additions
- **`style`**: Formatting changes that do not affect code logic
- **`refactor`**: Code restructuring without altering functionality
- **`perf`**: Performance optimizations
- **`test`**: Adding or modifying tests
- **`build`**: Changes that affect the build system or external dependencies
- **`ci`**: Changes to CI/CD workflows and automation scripts
- **`chore`**: Routine maintenance tasks and housekeeping

### Examples
- `feat(auth): add rate limiting on password reset endpoint`
- `fix(media): handle null user id in media ready listener`
- `ci(actions): add concurrency cancellation to docker workflow`

---

## Pull Request Process

1. Fork the repository and create your feature branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. Implement your changes following project patterns and existing architecture.
3. Write corresponding unit tests (`*.spec.ts`) or e2e tests (`*.e2e-spec.ts`).
4. Ensure `make check-all` passes with zero errors and zero warnings.
5. Push your branch to your fork and open a Pull Request against `main`.
6. Provide a clear description of the problem solved and link relevant issues (`Fixes #123`).

Thank you for helping make this starter project better!

