import { describe, it, expect } from 'vitest';
import { loadConfig, ConfigError } from '../config';

/** Minimal valid OIDC env for the multi-user mode tests. */
const validOidcEnv = {
  AUTH_MODE: 'oidc',
  DB_DRIVER: 'postgres',
  DATABASE_URL: 'postgres://holiday:secret@localhost:5432/holiday',
  OIDC_ISSUER_URL: 'https://idp.example.com/realms/holiday',
  OIDC_CLIENT_ID: 'my-holiday',
  OIDC_CLIENT_SECRET: 'client-secret',
  PUBLIC_BASE_URL: 'https://holiday.example.com',
  SESSION_SECRET: 'a'.repeat(32),
};

describe('loadConfig', () => {
  describe('defaults (single-user mode)', () => {
    it('returns full defaults for an empty env', () => {
      const config = loadConfig({});
      expect(config.API_PORT).toBe(3001);
      expect(config.API_HOST).toBe('127.0.0.1');
      expect(config.DB_DRIVER).toBe('sqlite');
      expect(config.DB_PATH).toBe('data/my-holiday.db');
      expect(config.AUTH_MODE).toBe('none');
      expect(config.ACCESS_TOKEN_TTL_S).toBe(900);
      expect(config.REFRESH_TOKEN_TTL_S).toBe(30 * 86400);
      expect(config.ADMIN_EMAILS).toEqual([]);
      expect(config.API_TOKEN).toBeUndefined();
      expect(config.CORS_ORIGIN).toBeUndefined();
    });

    it('coerces numeric strings from the environment', () => {
      const config = loadConfig({ API_PORT: '8080', ACCESS_TOKEN_TTL_S: '600' });
      expect(config.API_PORT).toBe(8080);
      expect(config.ACCESS_TOKEN_TTL_S).toBe(600);
    });

    it('passes through legacy single-user vars unchanged', () => {
      const config = loadConfig({
        DB_PATH: '/data/db.sqlite',
        API_TOKEN: 'legacy-token',
        CORS_ORIGIN: 'https://intranet.example.com',
      });
      expect(config.DB_PATH).toBe('/data/db.sqlite');
      expect(config.API_TOKEN).toBe('legacy-token');
      expect(config.CORS_ORIGIN).toBe('https://intranet.example.com');
    });

    it('parses ADMIN_EMAILS as a trimmed, lowercased list', () => {
      const config = loadConfig({ ADMIN_EMAILS: ' Anna@Example.com, bob@example.com ,' });
      expect(config.ADMIN_EMAILS).toEqual(['anna@example.com', 'bob@example.com']);
    });
  });

  describe('validation failures', () => {
    it('rejects an invalid API_PORT with a readable message', () => {
      expect(() => loadConfig({ API_PORT: 'not-a-port' })).toThrow(ConfigError);
      expect(() => loadConfig({ API_PORT: 'not-a-port' })).toThrow(/API_PORT/);
    });

    it('rejects an unknown DB_DRIVER', () => {
      expect(() => loadConfig({ DB_DRIVER: 'mysql' })).toThrow(/DB_DRIVER/);
    });

    it('rejects an unknown AUTH_MODE', () => {
      expect(() => loadConfig({ AUTH_MODE: 'basic' })).toThrow(/AUTH_MODE/);
    });

    it('rejects postgres driver without DATABASE_URL', () => {
      expect(() => loadConfig({ DB_DRIVER: 'postgres' })).toThrow(/DATABASE_URL/);
    });

    it('rejects a malformed DATABASE_URL', () => {
      expect(() =>
        loadConfig({ DB_DRIVER: 'postgres', DATABASE_URL: 'not a url' }),
      ).toThrow(/DATABASE_URL/);
    });
  });

  describe('AUTH_MODE=oidc cross-field rules', () => {
    it('accepts a complete oidc configuration', () => {
      const config = loadConfig(validOidcEnv);
      expect(config.AUTH_MODE).toBe('oidc');
      expect(config.DB_DRIVER).toBe('postgres');
      expect(config.OIDC_ISSUER_URL).toBe(validOidcEnv.OIDC_ISSUER_URL);
    });

    it('requires DB_DRIVER=postgres', () => {
      const env = { ...validOidcEnv, DB_DRIVER: 'sqlite' };
      expect(() => loadConfig(env)).toThrow(/postgres/i);
    });

    it.each(['OIDC_ISSUER_URL', 'OIDC_CLIENT_ID', 'OIDC_CLIENT_SECRET', 'PUBLIC_BASE_URL', 'SESSION_SECRET'])(
      'requires %s',
      (key) => {
        const env: Record<string, string> = { ...validOidcEnv };
        delete env[key];
        expect(() => loadConfig(env)).toThrow(new RegExp(key));
      },
    );

    it('rejects a SESSION_SECRET shorter than 32 characters', () => {
      expect(() => loadConfig({ ...validOidcEnv, SESSION_SECRET: 'short' })).toThrow(/SESSION_SECRET/);
    });

    it('rejects the legacy API_TOKEN in oidc mode', () => {
      expect(() => loadConfig({ ...validOidcEnv, API_TOKEN: 'legacy' })).toThrow(/API_TOKEN/);
    });

    it('reports every problem in one readable error', () => {
      try {
        loadConfig({ AUTH_MODE: 'oidc' });
        expect.unreachable('should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        const message = (error as Error).message;
        expect(message).toMatch(/OIDC_ISSUER_URL/);
        expect(message).toMatch(/SESSION_SECRET/);
        expect(message).toMatch(/PUBLIC_BASE_URL/);
      }
    });
  });
});
