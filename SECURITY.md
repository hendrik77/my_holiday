# Security Policy

## Security Model

My Holiday runs in one of two modes. **Single-user mode** (the default) is a
locally-hosted planner that binds to `127.0.0.1`, so the API is unreachable
from other devices, and has **no built-in authentication** — intentional for
the personal use case. Do not expose it to the internet without an
authentication layer in front (reverse-proxy Basic Auth or SSO). **Multi-user
mode** (`AUTH_MODE=oidc`, v3) authenticates against an external OIDC provider
and is designed to be exposed behind TLS.

## Multi-user mode security model

When `AUTH_MODE=oidc` (see [ADR-0007](docs/adr/0007-oidc-auth-cookie-sessions.md)
and [ADR-0008](docs/adr/0008-personal-access-tokens.md)):

- **Login** is OpenID Connect authorization-code + PKCE (S256). The `state`,
  `nonce`, and PKCE verifier ride in a short-lived signed cookie, so login
  CSRF (forcing a victim's browser to complete an attacker's login) is
  prevented — the state is bound to the browser that started the flow.
- **Sessions** are a short-lived (15 min) HS256 JWT in an httpOnly,
  `SameSite=Lax` cookie, renewed by an opaque **refresh token** that is stored
  only as a sha256 hash. Refresh tokens rotate on every use; replaying a
  rotated token is treated as theft and revokes the whole token family.
- **CSRF**: the SPA is served same-origin by the API, and cookies are
  `SameSite=Lax`, so the browser does not attach them to cross-site
  state-changing (POST/PUT/DELETE) requests. Combined with the strict CORS
  allowlist this is the CSRF defense; there is no separate CSRF token.
- **CSRF caveat (same machine)**: `SameSite` is port-agnostic, so another
  process on `localhost` (a different port) is same-site. On a shared local
  host set `CORS_ORIGIN` explicitly rather than relying on the localhost
  allowlist default.
- **Personal access tokens** (`mh_pat_…`) are 256-bit random values stored
  sha256-hashed, user-scoped, individually revocable, `full` or `read`-only,
  and shown exactly once. They can be used as `Authorization: Bearer` but can
  never mint or revoke other PATs (that path is session-cookie-only).
- **Rate limiting**: the auth endpoints and the token-management router are
  rate-limited per IP, and the whole `/api/v1` surface is bounded in oidc mode
  (each bearer request costs a hash lookup). Put the app behind a single
  trusted reverse proxy — `trust proxy` is set to one hop.
- **Privacy**: managers see only their direct reports (admins see all), and
  notes are hidden unless the org privacy level is `dates_notes`; managers
  always see dates as a role right.

## Known Limitations

These are intentional tradeoffs of **single-user mode** (`AUTH_MODE=none`);
multi-user mode addresses authentication, CSRF, and rate limiting as described
above.

- **No authentication by default** — the API accepts all requests without credentials. As an opt-in hardening step, set the `API_TOKEN` environment variable: every `/api/v1` request must then carry `Authorization: Bearer <token>` (the CLI sends it via `MY_HOLIDAY_API_TOKEN` / `--token`). The web UI does not attach a token itself, so `API_TOKEN` suits CLI/API-only deployments or setups where an authenticating reverse proxy injects the header. For real accounts, use [multi-user mode](README.md#multi-user-mode-oidc).
- **CORS restricted to local origins by default** — the API only answers cross-origin browser requests from `localhost` / `127.0.0.1` / `[::1]` origins (any port). Web pages on other origins cannot read or write the API from a visitor's browser. Set `CORS_ORIGIN` to allow one specific additional origin. Same-origin use (the SPA served by the API itself) is unaffected.
- **DNS rebinding** — CORS does not stop an attacker-controlled hostname that rebinds to `127.0.0.1`; setting `API_TOKEN` closes this vector because the attacker's page cannot supply the token.
- **No rate limiting in single-user mode** — not relevant for a localhost app; multi-user mode rate-limits the auth and token surfaces per IP
- **PostgreSQL compose service has no port mapping and no default password** — the optional `db` service (`docker compose --profile postgres up`) is reachable only from the compose network and refuses to start unless `POSTGRES_PASSWORD` is set. Do not add a host `ports:` mapping without also treating that password as a production credential.
- **No CSRF protection in single-user mode** — acceptable with no sessions; multi-user mode relies on `SameSite=Lax` cookies + same-origin serving + the CORS allowlist (see the model above)

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
