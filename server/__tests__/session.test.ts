// @vitest-environment node
// jose resolves its browser build under jsdom, where cross-realm Uint8Array
// checks fail ("payload must be an instance of Uint8Array"). Server tests
// have no DOM dependency — run this file in the node environment.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDb, DEFAULT_USER_ID, type Db } from '../db';
import { loadConfig } from '../config';
import {
  createSessionToken,
  verifySessionToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from '../auth/session';

const SECRET = 'test-secret-at-least-32-bytes-long!!';

describe('app session JWT', () => {
  const claims = { sub: DEFAULT_USER_ID, role: 'admin' as const, name: 'Local user', email: 'local@my-holiday.invalid' };

  it('signs and verifies round-trip claims', async () => {
    const token = await createSessionToken(claims, SECRET, 900);
    const verified = await verifySessionToken(token, SECRET);
    expect(verified).toMatchObject(claims);
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await createSessionToken(claims, SECRET, 900);
    expect(await verifySessionToken(token, 'another-secret-also-32-bytes-long!!')).toBeNull();
  });

  it('rejects an expired token', async () => {
    const token = await createSessionToken(claims, SECRET, -10);
    expect(await verifySessionToken(token, SECRET)).toBeNull();
  });

  it('rejects garbage', async () => {
    expect(await verifySessionToken('not-a-jwt', SECRET)).toBeNull();
  });

  it('rejects a token minted for a different purpose, even with the right secret', async () => {
    const { SignJWT } = await import('jose');
    // Shaped like a login-state token (same secret, same alg, wrong typ).
    const foreign = await new SignJWT({ typ: 'login_state', role: 'admin', name: 'x', email: 'x@y.z' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(DEFAULT_USER_ID)
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifySessionToken(foreign, SECRET)).toBeNull();
  });
});

describe('refresh-token rotation', () => {
  let db: Db;

  beforeEach(async () => {
    db = await createDb(loadConfig({ DB_DRIVER: 'sqlite', DB_PATH: ':memory:' }));
  });

  afterEach(async () => {
    await db.close();
  });

  it('issues an opaque token and rotates it into the same family', async () => {
    const issued = await issueRefreshToken(db, DEFAULT_USER_ID, 3600);
    expect(issued.token.length).toBeGreaterThanOrEqual(43); // 32 bytes base64url

    const rotated = await rotateRefreshToken(db, issued.token, 3600);
    expect(rotated).not.toBeNull();
    expect(rotated!.userId).toBe(DEFAULT_USER_ID);
    expect(rotated!.token).not.toBe(issued.token);
  });

  it('detects reuse of a rotated token and revokes the whole family', async () => {
    const first = await issueRefreshToken(db, DEFAULT_USER_ID, 3600);
    const second = await rotateRefreshToken(db, first.token, 3600);
    expect(second).not.toBeNull();

    // Replay of the already-rotated token: attack signal.
    expect(await rotateRefreshToken(db, first.token, 3600)).toBeNull();

    // The legitimate successor is collateral damage — family is dead.
    expect(await rotateRefreshToken(db, second!.token, 3600)).toBeNull();
  });

  it('two concurrent uses of the same token yield at most one successor', async () => {
    const issued = await issueRefreshToken(db, DEFAULT_USER_ID, 3600);

    // TOCTOU guard: without an atomic claim, both racers pass the
    // "not yet rotated" check and both receive valid successors.
    const results = await Promise.all([
      rotateRefreshToken(db, issued.token, 3600),
      rotateRefreshToken(db, issued.token, 3600),
    ]);
    expect(results.filter((r) => r !== null)).toHaveLength(1);
  });

  it('rejects unknown and expired tokens', async () => {
    expect(await rotateRefreshToken(db, 'unknown-token', 3600)).toBeNull();

    const shortLived = await issueRefreshToken(db, DEFAULT_USER_ID, -10);
    expect(await rotateRefreshToken(db, shortLived.token, 3600)).toBeNull();
  });

  it('revokeRefreshToken (logout) kills the family', async () => {
    const issued = await issueRefreshToken(db, DEFAULT_USER_ID, 3600);
    await revokeRefreshToken(db, issued.token);
    expect(await rotateRefreshToken(db, issued.token, 3600)).toBeNull();
  });
});
