import type { RequestHandler } from 'express';
import type { Db } from '../db/types';
import type { Config } from '../config';
import type { UserRole } from '../types';
import { DEFAULT_USER_ID } from '../db/constants';
import { verifySessionToken, hashToken } from './session';

/** Write last_used_at at most once per minute per token. */
const LAST_USED_THROTTLE_MS = 60_000;
// HEAD is read-only because Express dispatches it to the GET handler.
// OPTIONS never reaches this middleware today (cors() answers it first) —
// listed defensively in case the mount order ever changes.
const READONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Scheme name is case-insensitive per RFC 9110; the token itself is not.
const BEARER_RE = /^Bearer\s+(mh_pat_[A-Za-z0-9_-]+)$/;
const BEARER_SCHEME_RE = /^bearer\s/i;

/**
 * Resolve the acting user (ADR-0007):
 *  - AUTH_MODE=none — every request is the synthetic default user (the
 *    legacy API_TOKEN guard, when configured, runs app-level before this).
 *  - AUTH_MODE=oidc — a valid mh_session JWT cookie or a personal access
 *    token (`Authorization: Bearer mh_pat_…`, ADR-0008) is required;
 *    anything else is 401. Read-scope PATs reject non-GET methods.
 */
export function requireUser(db: Db, config: Config): RequestHandler {
  return async (req, res, next) => {
    try {
      if (config.AUTH_MODE === 'none') {
        const user = await db.users.findById(DEFAULT_USER_ID);
        if (!user) {
          res.status(500).json({ error: 'Default user missing — database not migrated?' });
          return;
        }
        req.user = user;
        next();
        return;
      }

      const token = (req.cookies as Record<string, string> | undefined)?.mh_session;
      if (typeof token === 'string') {
        const claims = await verifySessionToken(token, config.SESSION_SECRET!);
        if (claims) {
          const user = await db.users.findById(claims.sub);
          if (user) {
            req.user = user;
            next();
            return;
          }
        }
      }

      const header = req.get('authorization') ?? '';
      const bearer = BEARER_SCHEME_RE.test(header)
        ? BEARER_RE.exec(`Bearer ${header.replace(BEARER_SCHEME_RE, '')}`)
        : null;
      if (bearer) {
        // Plain indexed equality on the sha256 digest — deliberately not a
        // timing-safe compare (unlike the legacy API_TOKEN guard): any DB
        // timing signal reveals digest similarity at best, and forging a
        // token needs the 256-bit random *pre-image*, not the digest
        // (documented risk acceptance, security review M2).
        const pat = await db.pats.findByHash(hashToken(bearer[1]));
        const valid =
          pat !== null &&
          pat.revokedAt === null &&
          (pat.expiresAt === null || pat.expiresAt > new Date().toISOString());
        if (valid) {
          if (pat.scope === 'read' && !READONLY_METHODS.has(req.method)) {
            res.status(403).json({ error: 'This token is read-only' });
            return;
          }
          const user = await db.users.findById(pat.userId);
          if (user) {
            if (!pat.lastUsedAt || Date.parse(pat.lastUsedAt) < Date.now() - LAST_USED_THROTTLE_MS) {
              await db.pats.touchLastUsed(pat.id);
            }
            req.user = user;
            next();
            return;
          }
        }
      }

      res.status(401).json({ error: 'Authentication required' });
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Session-cookie-only variant for privileged self-service endpoints
 * (token management, ADR-0008): a PAT must never be able to mint or
 * revoke PATs, so bearer tokens are deliberately not accepted here.
 */
export function requireSessionUser(db: Db, config: Config): RequestHandler {
  return async (req, res, next) => {
    try {
      const token = (req.cookies as Record<string, string> | undefined)?.mh_session;
      if (typeof token === 'string') {
        const claims = await verifySessionToken(token, config.SESSION_SECRET!);
        if (claims) {
          const user = await db.users.findById(claims.sub);
          if (user) {
            req.user = user;
            next();
            return;
          }
        }
      }
      res.status(401).json({ error: 'Authentication required' });
    } catch (error) {
      next(error);
    }
  };
}

/** 403 unless req.user has one of the given roles. Requires requireUser upstream. */
export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient role' });
      return;
    }
    next();
  };
}
