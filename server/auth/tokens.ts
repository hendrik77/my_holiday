import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { randomBytes } from 'node:crypto';
import type { Db } from '../db/types';
import type { Config } from '../config';
import type { PatRow } from '../types';
import { hashToken } from './session';
import { requireSessionUser } from './middleware';

/**
 * Personal-access-token self-service (Phase 6, ADR-0008), mounted at
 * /api/v1/tokens in oidc mode only. Session-cookie auth exclusively — a
 * PAT can never mint or revoke PATs. The raw token is returned exactly
 * once at creation; only its sha256 hash is stored.
 */

const MAX_NAME_LENGTH = 100;
/** Cap on active (non-revoked) tokens per user (security review M1). */
const MAX_ACTIVE_TOKENS = 25;
/** Longest allowed expiry — hygiene bound, not a security property. */
const MAX_EXPIRY_MS = 10 * 365 * 24 * 3600 * 1000;

/** Everything a client may see about a PAT — never the hash. */
function toPublicPat(pat: PatRow) {
  const { id, name, tokenPrefix, scope, expiresAt, lastUsedAt, createdAt, revokedAt } = pat;
  return { id, name, tokenPrefix, scope, expiresAt, lastUsedAt, createdAt, revokedAt };
}

export function createTokensRouter(db: Db, config: Config): Router {
  const router = Router();
  // Minting writes a row per call — bound it like the auth endpoints
  // (security review H1).
  router.use(rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false }));
  router.use(requireSessionUser(db, config));

  router.get('/', async (req, res) => {
    const pats = await db.pats.listForUser(req.user!.id);
    res.json(pats.map(toPublicPat));
  });

  router.post('/', async (req, res) => {
    const { name, scope, expiresAt } = req.body as Record<string, unknown>;

    if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > MAX_NAME_LENGTH) {
      res.status(400).json({ error: `name must be 1–${MAX_NAME_LENGTH} characters` });
      return;
    }
    if (scope !== 'full' && scope !== 'read') {
      res.status(400).json({ error: "scope must be 'full' or 'read'" });
      return;
    }
    let expiry: string | null = null;
    if (expiresAt !== undefined && expiresAt !== null) {
      const parsed = typeof expiresAt === 'string' ? Date.parse(expiresAt) : NaN;
      // Bounds are hygiene (security review M3): the past is useless, and a
      // multi-century expiry defeats the point of having one.
      if (Number.isNaN(parsed) || parsed <= Date.now() || parsed > Date.now() + MAX_EXPIRY_MS) {
        res.status(400).json({ error: 'expiresAt must be an ISO timestamp in the future (at most 10 years out) or null' });
        return;
      }
      expiry = new Date(parsed).toISOString();
    }

    const active = (await db.pats.listForUser(req.user!.id)).filter((p) => p.revokedAt === null);
    if (active.length >= MAX_ACTIVE_TOKENS) {
      res.status(400).json({
        error: `Too many active tokens (limit ${MAX_ACTIVE_TOKENS}) — revoke one first`,
      });
      return;
    }

    const raw = `mh_pat_${randomBytes(32).toString('base64url')}`;
    const pat = await db.pats.create({
      userId: req.user!.id,
      name: name.trim(),
      tokenHash: hashToken(raw),
      tokenPrefix: raw.slice(0, 12),
      scope,
      expiresAt: expiry,
    });

    res.status(201).json({ token: raw, pat: toPublicPat(pat) });
  });

  router.delete('/:id', async (req, res) => {
    const revoked = await db.pats.revoke(req.user!.id, req.params.id);
    if (!revoked) {
      res.status(404).json({ error: 'Token not found' });
      return;
    }
    res.status(204).send();
  });

  return router;
}
