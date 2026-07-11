import { z } from 'zod';

/**
 * Central, validated runtime configuration (ADR-0006 / ADR-0007).
 *
 * Two permanent product modes are gated here:
 *  - DB_DRIVER: sqlite (single-user default) | postgres (required for multi-user)
 *  - AUTH_MODE: none (single-user default)   | oidc     (multi-user)
 *
 * `AUTH_MODE=oidc` requires the OIDC block, a session secret, a public base
 * URL, and DB_DRIVER=postgres — enforced below so misconfiguration fails at
 * startup, not at first login.
 */

const MIN_SESSION_SECRET_LENGTH = 32;
const DEFAULT_ACCESS_TOKEN_TTL_S = 900; // 15 minutes
const DEFAULT_REFRESH_TOKEN_TTL_S = 30 * 86400; // 30 days

/** Comma-separated email list → trimmed, lowercased array. */
const emailList = z
  .string()
  .default('')
  .transform((raw) =>
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0),
  );

const configSchema = z
  .object({
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    API_HOST: z.string().default('127.0.0.1'),

    DB_DRIVER: z.enum(['sqlite', 'postgres']).default('sqlite'),
    DB_PATH: z.string().default('data/my-holiday.db'),
    DATABASE_URL: z.url().optional(),

    AUTH_MODE: z.enum(['none', 'oidc']).default('none'),
    OIDC_ISSUER_URL: z.url().optional(),
    OIDC_CLIENT_ID: z.string().min(1).optional(),
    OIDC_CLIENT_SECRET: z.string().min(1).optional(),
    PUBLIC_BASE_URL: z.url().optional(),
    SESSION_SECRET: z.string().min(MIN_SESSION_SECRET_LENGTH).optional(),
    ACCESS_TOKEN_TTL_S: z.coerce.number().int().positive().default(DEFAULT_ACCESS_TOKEN_TTL_S),
    REFRESH_TOKEN_TTL_S: z.coerce.number().int().positive().default(DEFAULT_REFRESH_TOKEN_TTL_S),
    ADMIN_EMAILS: emailList,

    CORS_ORIGIN: z.string().optional(),
    /** Legacy opt-in static bearer token (ADR-0004). Single-user mode only. */
    API_TOKEN: z.string().optional(),
  })
  .superRefine((config, ctx) => {
    if (config.DB_DRIVER === 'postgres' && !config.DATABASE_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'DATABASE_URL is required when DB_DRIVER=postgres',
      });
    }

    if (config.AUTH_MODE === 'oidc') {
      if (config.DB_DRIVER !== 'postgres') {
        ctx.addIssue({
          code: 'custom',
          path: ['DB_DRIVER'],
          message: 'AUTH_MODE=oidc requires DB_DRIVER=postgres (multi-user data layer)',
        });
      }
      const required = [
        'OIDC_ISSUER_URL',
        'OIDC_CLIENT_ID',
        'OIDC_CLIENT_SECRET',
        'PUBLIC_BASE_URL',
        'SESSION_SECRET',
      ] as const;
      for (const key of required) {
        if (config[key] === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} is required when AUTH_MODE=oidc`,
          });
        }
      }
      if (config.API_TOKEN !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['API_TOKEN'],
          message: 'API_TOKEN is not supported with AUTH_MODE=oidc — use personal access tokens instead',
        });
      }
    }
  });

export type Config = z.infer<typeof configSchema>;

/** Thrown when the environment fails validation; message lists every issue. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Parse and validate configuration from an environment map.
 * Throws {@link ConfigError} listing every problem (one per line).
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const result = configSchema.safeParse(env);
  if (!result.success) {
    const lines = result.error.issues.map((issue) => {
      const key = issue.path.join('.') || '(config)';
      return `  ${key}: ${issue.message}`;
    });
    throw new ConfigError(`Invalid configuration:\n${lines.join('\n')}`);
  }
  return result.data;
}
