import type { UserRow } from './types';

/**
 * The authenticated user of the current request, set by auth middleware
 * (Phase 4). Optional: in single-user mode the router falls back to the
 * synthetic default user.
 */
declare global {
  namespace Express {
    interface Request {
      user?: UserRow;
    }
  }
}

export {};
