# Security Policy

We take the security of the NestJS Starter project and the applications built on top of it seriously.

---

## Supported Versions

Only the latest release on the `main` branch receives active security updates and vulnerability patches.

| Version | Supported          |
| :------ | :----------------- |
| `1.x`   | :white_check_mark: |
| `< 1.0` | :x:                |

---

## Automated Security Scans

This repository continuously runs multi-layer automated security checks via GitHub Actions:
- **CodeQL (SAST)**: Static code analysis for JavaScript and TypeScript to prevent SQL injection, prototype pollution, and security regressions.
- **Trivy Container Scanner**: Scans base Docker images and container OS libraries for known Common Vulnerabilities and Exposures (CVEs).
- **npm audit**: Scans all production and development dependencies against known advisory databases.
- **Dependabot**: Automatically monitors and proposes updates for vulnerable dependencies and GitHub Actions.

---

## Reporting a Vulnerability

If you discover a security vulnerability within this project, please **do not open a public issue**. Publicly disclosing a vulnerability can put production systems at risk.

Instead, please report the vulnerability privately through GitHub's Security Advisories:
1. Navigate to the **Security** tab of this repository.
2. Click on **Report a vulnerability** under the Advisories section.
3. Provide detailed steps to reproduce the vulnerability, including affected endpoints, environment details, and proof of concept if applicable.

Alternatively, you can contact the project maintainer directly via email at:
**omar.sa6ry@gmail.com**

### What to Expect:
- **Acknowledgment**: You will receive an initial response within 48 hours acknowledging receipt of your report.
- **Assessment**: We will confirm the vulnerability and assess its severity and impact.
- **Resolution**: A patch will be developed, tested through the CI/CD pipeline, and released in a prioritized update.
- **Credit**: If desired, you will be publicly credited in the release notes for your responsible disclosure.

