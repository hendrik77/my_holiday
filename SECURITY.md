# Security Policy

## Security Model

My Holiday is a **single-user, locally-hosted** vacation planner. It binds to `127.0.0.1` by default, so the API is unreachable from other devices. It has **no built-in authentication** — this is intentional for the personal use case. Do not expose it to the internet without adding an authentication layer in front of it (e.g. an nginx reverse proxy with HTTP Basic Auth, or an SSO provider).

## Known Limitations

These are intentional design tradeoffs, not bugs:

- **No authentication** — the API accepts all requests without credentials when accessed on the loopback interface
- **Permissive CORS default** — without `CORS_ORIGIN` set, the API reflects any origin; restrict this in any networked deployment
- **No rate limiting** — not relevant for a single-user localhost app, but must be added before any public exposure
- **No CSRF protection** — acceptable in the current threat model; required if the app is ever exposed with session-based auth

## Reporting a Vulnerability

If you find a security issue, please **do not open a public GitHub issue**.

Send a private report to: **h-n@gmx.net**

Include:
- A description of the vulnerability
- Steps to reproduce
- The potential impact

Response times by severity:

| Severity | Acknowledgement | Fix target |
|----------|----------------|------------|
| Critical (RCE, data loss, auth bypass) | 2 business days | Best effort / as fast as possible |
| All others | 5 business days | 30 days |

## Out of Scope

- Vulnerabilities that require physical access to the host machine
- Issues in dependencies that have no available fix upstream
- Rate-limiting / brute-force on a localhost-only deployment
