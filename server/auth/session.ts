import { SignJWT, jwtVerify } from 'jose';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Db } from '../db/types';
import type { UserRole } from '../types';

/**
 * App sessions (ADR-0007): a short-lived HS256 JWT carries identity claims;
 * a long-lived opaque refresh token — stored only as a sha256 hash — renews
 * it. Refresh tokens rotate on every use inside a family; presenting an
 * already-rotated token is treated as theft and revokes the whole family.
 */

export interface SessionClaims {
  /** User id. */
  sub: string;
  role: UserRole;
  name: string;
  email: string;
}

const encoder = new TextEncoder();

export async function createSessionToken(claims: SessionClaims, secret: string, ttlSeconds: number): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ role: claims.role, name: claims.name, email: claims.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .sign(encoder.encode(secret));
}

export async function verifySessionToken(token: string, secret: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, encoder.encode(secret), { algorithms: ['HS256'] });
    if (typeof payload.sub !== 'string') return null;
    return {
      sub: payload.sub,
      role: payload.role as UserRole,
      name: payload.name as string,
      email: payload.email as string,
    };
  } catch {
    return null;
  }
}

/** sha256 hex of an opaque token — the only form that ever touches the DB. */
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function opaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export interface IssuedRefreshToken {
  token: string;
  expiresAt: string;
}

/** Issue a fresh refresh token; omit familyId to start a new family (login). */
export async function issueRefreshToken(
  db: Db,
  userId: string,
  ttlSeconds: number,
  familyId?: string,
): Promise<IssuedRefreshToken> {
  const token = opaqueToken();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  await db.refreshTokens.create({
    userId,
    tokenHash: hashToken(token),
    familyId: familyId ?? randomUUID(),
    expiresAt,
  });
  return { token, expiresAt };
}

export interface RotatedRefreshToken extends IssuedRefreshToken {
  userId: string;
}

/**
 * Exchange a refresh token for its successor. Returns null — and the caller
 * must treat the session as dead — for unknown, expired, or revoked tokens.
 * A token that was already rotated is a replay: the whole family is revoked.
 */
export async function rotateRefreshToken(
  db: Db,
  rawToken: string,
  ttlSeconds: number,
): Promise<RotatedRefreshToken | null> {
  const row = await db.refreshTokens.findByHash(hashToken(rawToken));
  if (!row || row.revokedAt !== null || row.expiresAt < new Date().toISOString()) return null;

  if (row.rotatedAt !== null) {
    await db.refreshTokens.revokeFamily(row.familyId);
    return null;
  }

  await db.refreshTokens.markRotated(row.id);
  const issued = await issueRefreshToken(db, row.userId, ttlSeconds, row.familyId);
  return { ...issued, userId: row.userId };
}

/** Logout: revoke the token's whole family. Unknown tokens are a no-op. */
export async function revokeRefreshToken(db: Db, rawToken: string): Promise<void> {
  const row = await db.refreshTokens.findByHash(hashToken(rawToken));
  if (row) await db.refreshTokens.revokeFamily(row.familyId);
}
