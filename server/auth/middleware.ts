import type { RequestHandler } from 'express';
import type { Db } from '../db/types';
import type { Config } from '../config';
import type { UserRole } from '../types';
import { DEFAULT_USER_ID } from '../db/constants';
import { verifySessionToken } from './session';

/**
 * Resolve the acting user (ADR-0007):
 *  - AUTH_MODE=none — every request is the synthetic default user (the
 *    legacy API_TOKEN guard, when configured, runs app-level before this).
 *  - AUTH_MODE=oidc — a valid mh_session JWT cookie is required; anything
 *    else is 401. (PAT bearer support lands in Phase 6.)
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
