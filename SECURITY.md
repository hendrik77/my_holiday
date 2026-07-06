# Security Policy

## Security Model

My Holiday is a **single-user, locally-hosted** vacation planner. It binds to `127.0.0.1` by default, so the API is unreachable from other devices. It has **no built-in authentication** — this is intentional for the personal use case. Do not expose it to the internet without adding an authentication layer in front of it (e.g. an nginx reverse proxy with HTTP Basic Auth, or an SSO provider).

## Known Limitations

These are intentional design tradeoffs, not bugs:

- **No authentication by default** — the API accepts all requests without credentials. As an opt-in hardening step, set the `API_TOKEN` environment variable: every `/api/v1` request must then carry `Authorization: Bearer <token>` (the CLI sends it via `MY_HOLIDAY_API_TOKEN` / `--token`). The web UI does not attach a token itself, so `API_TOKEN` suits CLI/API-only deployments or setups where an authenticating reverse proxy injects the header. Full multi-user auth lands with v3.
- **CORS restricted to local origins by default** — the API only answers cross-origin browser requests from `localhost` / `127.0.0.1` / `[::1]` origins (any port). Web pages on other origins cannot read or write the API from a visitor's browser. Set `CORS_ORIGIN` to allow one specific additional origin. Same-origin use (the SPA served by the API itself) is unaffected.
- **DNS rebinding** — CORS does not stop an attacker-controlled hostname that rebinds to `127.0.0.1`; setting `API_TOKEN` closes this vector because the attacker's page cannot supply the token.
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
