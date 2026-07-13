import type { Pool } from 'pg';
import type { UserRow, UpsertUserInput, UserProfileUpdate } from '../../types';
import type { UsersRepo } from '../types';
import { rowToUser } from '../rows';

/** PostgreSQL users repository — same semantics as the SQLite driver, verified by the shared contract suite. */
export function createPostgresUsersRepo(pool: Pool): UsersRepo {
  async function findById(id: string): Promise<UserRow | null> {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0] ? rowToUser(rows[0]) : null;
  }

  return {
    findById,

    async findByOidcSub(oidcSub: string): Promise<UserRow | null> {
      const { rows } = await pool.query('SELECT * FROM users WHERE oidc_sub = $1', [oidcSub]);
      return rows[0] ? rowToUser(rows[0]) : null;
    },

    async upsertFromIdP(input: UpsertUserInput): Promise<UserRow> {
      const now = new Date().toISOString();
      // Atomic create-or-refresh keyed by oidc_sub; role/team/manager_id are
      // admin-managed and never touched here.
      const { rows } = await pool.query(
        `INSERT INTO users (id, oidc_sub, email, name, team, role, manager_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, '', 'employee', NULL, $5, $5)
         ON CONFLICT (oidc_sub) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name, updated_at = EXCLUDED.updated_at
         RETURNING *`,
        // Lowercased at storage so casing can't split one identity into two
        // rows under the UNIQUE constraint (security review M4).
        [crypto.randomUUID(), input.oidcSub, input.email.toLowerCase(), input.name, now],
      );
      return rowToUser(rows[0]);
    },

    async listAll(): Promise<UserRow[]> {
      const { rows } = await pool.query('SELECT * FROM users ORDER BY email');
      return rows.map(rowToUser);
    },

    async listDirectReports(managerId: string): Promise<UserRow[]> {
      const { rows } = await pool.query('SELECT * FROM users WHERE manager_id = $1 ORDER BY email', [managerId]);
      return rows.map(rowToUser);
    },

    async updateProfile(id: string, updates: UserProfileUpdate): Promise<UserRow | null> {
      const fields: string[] = [];
      const values: unknown[] = [];
      let i = 1;

      if (updates.name !== undefined) { fields.push(`name = $${i++}`); values.push(updates.name); }
      if (updates.team !== undefined) { fields.push(`team = $${i++}`); values.push(updates.team); }
      if (updates.role !== undefined) { fields.push(`role = $${i++}`); values.push(updates.role); }
      if (updates.managerId !== undefined) { fields.push(`manager_id = $${i++}`); values.push(updates.managerId); }

      fields.push(`updated_at = $${i++}`);
      values.push(new Date().toISOString());
      values.push(id);

      const { rows } = await pool.query(
        `UPDATE users SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
        values,
      );
      return rows[0] ? rowToUser(rows[0]) : null;
    },
  };
}
