import type Database from 'better-sqlite3';
import type { UserRow, UpsertUserInput, UserProfileUpdate } from '../../types';
import type { UsersRepo } from '../types';
import { rowToUser } from '../rows';

/** SQLite users repository (migration 002). */
export function createSqliteUsersRepo(db: Database.Database): UsersRepo {
  function findById(id: string): UserRow | null {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? rowToUser(row) : null;
  }

  return {
    async findById(id: string): Promise<UserRow | null> {
      return findById(id);
    },

    async findByOidcSub(oidcSub: string): Promise<UserRow | null> {
      const row = db.prepare('SELECT * FROM users WHERE oidc_sub = ?').get(oidcSub) as
        | Record<string, unknown>
        | undefined;
      return row ? rowToUser(row) : null;
    },

    async upsertFromIdP(input: UpsertUserInput): Promise<UserRow> {
      const now = new Date().toISOString();
      // Lowercased at storage so casing can't split one identity into two
      // rows under the UNIQUE constraint (security review M4).
      const email = input.email.toLowerCase();
      const existing = db.prepare('SELECT id FROM users WHERE oidc_sub = ?').get(input.oidcSub) as
        | { id: string }
        | undefined;

      if (existing) {
        db.prepare('UPDATE users SET email = ?, name = ?, updated_at = ? WHERE id = ?').run(
          email,
          input.name,
          now,
          existing.id,
        );
        return findById(existing.id)!;
      }

      const id = crypto.randomUUID();
      db.prepare(
        `INSERT INTO users (id, oidc_sub, email, name, team, role, manager_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, '', 'employee', NULL, ?, ?)`,
      ).run(id, input.oidcSub, email, input.name, now, now);
      return findById(id)!;
    },

    async listAll(): Promise<UserRow[]> {
      const rows = db.prepare('SELECT * FROM users ORDER BY email').all() as Record<string, unknown>[];
      return rows.map(rowToUser);
    },

    async listDirectReports(managerId: string): Promise<UserRow[]> {
      const rows = db
        .prepare('SELECT * FROM users WHERE manager_id = ? ORDER BY email')
        .all(managerId) as Record<string, unknown>[];
      return rows.map(rowToUser);
    },

    async updateProfile(id: string, updates: UserProfileUpdate): Promise<UserRow | null> {
      if (!findById(id)) return null;

      const fields: string[] = [];
      const values: unknown[] = [];

      if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
      if (updates.team !== undefined) { fields.push('team = ?'); values.push(updates.team); }
      if (updates.role !== undefined) { fields.push('role = ?'); values.push(updates.role); }
      if (updates.managerId !== undefined) { fields.push('manager_id = ?'); values.push(updates.managerId); }

      fields.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(id);

      db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      return findById(id);
    },
  };
}
