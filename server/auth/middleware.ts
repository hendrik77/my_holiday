import type { RequestHandler } from 'express';
import type { Db } from '../db/types';
import type { Config } from '../config';
import type { UserRole } from '../types';
import { DEFAULT_USER_ID } from '../db/constants';
import { verifySessionToken, hashToken } from './session';

/** Write last_used_at at most once per minute per token. */
const LAST_USED_THROTTLE_MS = 60_000;
const READONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

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

      const bearer = /^Bearer\s+(mh_pat_[A-Za-z0-9_-]+)$/i.exec(req.get('authorization') ?? '');
      if (bearer) {
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
