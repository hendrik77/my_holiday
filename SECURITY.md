# Security Policy

## Scope

My Holiday is a **single-user, locally-hosted** vacation planner. It has no built-in authentication. Do not expose it to the internet without adding an authentication layer in front of it (e.g. an nginx reverse proxy with HTTP Basic Auth, or an SSO provider).

## Reporting a Vulnerability

If you find a security issue, please **do not open a public GitHub issue**.

Send a private report to: **h-n@gmx.net**

Include:
- A description of the vulnerability
- Steps to reproduce
- The potential impact

I will acknowledge within 5 business days and aim to release a fix within 30 days for confirmed issues.

## Out of Scope

- Vulnerabilities that require physical access to the host machine
- Issues in dependencies that have no available fix upstream
- Rate-limiting / brute-force on a localhost-only deployment
