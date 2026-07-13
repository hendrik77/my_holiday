import { Router } from 'express';
import type { Db } from './db/types';
import type { UserRow, PrivacyLevel } from './types';
import { requireRole } from './auth/middleware';

const PRIVACY_LEVELS: ReadonlySet<string> = new Set(['nothing', 'dates', 'dates_notes']);
const ROLES: ReadonlySet<string> = new Set(['employee', 'manager', 'admin']);

/** User as exposed to admins/team views — never oidc_sub or timestamps. */
function toPublicUser(user: UserRow) {
  const { id, name, email, team, role, managerId } = user;
  return { id, name, email, team, role, managerId };
}

/**
 * Team overlay + org administration (Phase 7), oidc mode only. Mounted
 * behind requireUser; every route adds its own role gate. Managers always
 * see their reports' dates (role right) — privacyLevel only governs
 * whether notes are included; colleague visibility is v4.
 */
export function createOrgRouter(db: Db): Router {
  const router = Router();

  router.get('/team/periods', requireRole('manager', 'admin'), async (req, res) => {
    let year = new Date().getFullYear();
    if (req.query.year !== undefined) {
      year = parseInt(req.query.year as string, 10);
      if (Number.isNaN(year)) {
        res.status(400).json({ error: 'Invalid year' });
        return;
      }
    }

    const me = req.user!;
    const members =
      me.role === 'admin'
        ? (await db.users.listAll()).filter((u) => u.id !== me.id)
        : await db.users.listDirectReports(me.id);
    const includeNotes = (await db.orgSettings.getPrivacyLevel()) === 'dates_notes';

    const rows = [];
    for (const member of members) {
      const periods = await db.periods.listByYear(member.id, year);
      rows.push({
        user: { id: member.id, name: member.name, team: member.team },
        periods: periods.map((p) => ({ ...p, note: includeNotes ? p.note : '' })),
      });
    }
    res.json(rows);
  });

  router.get('/org/settings', requireRole('admin'), async (_req, res) => {
    res.json({ privacyLevel: await db.orgSettings.getPrivacyLevel() });
  });

  router.put('/org/settings', requireRole('admin'), async (req, res) => {
    const { privacyLevel } = req.body as Record<string, unknown>;
    if (typeof privacyLevel !== 'string' || !PRIVACY_LEVELS.has(privacyLevel)) {
      res.status(400).json({ error: "privacyLevel must be 'nothing', 'dates', or 'dates_notes'" });
      return;
    }
    await db.orgSettings.setPrivacyLevel(privacyLevel as PrivacyLevel);
    res.json({ privacyLevel });
  });

  router.get('/admin/users', requireRole('admin'), async (_req, res) => {
    res.json((await db.users.listAll()).map(toPublicUser));
  });

  router.put('/admin/users/:id', requireRole('admin'), async (req, res) => {
    // Express can't infer the :id param type through the requireRole
    // middleware, so it widens to string | string[]; it is a route param.
    const id = req.params.id as string;
    const target = await db.users.findById(id);
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const { role, team, managerId } = req.body as Record<string, unknown>;
    const updates: Parameters<typeof db.users.updateProfile>[1] = {};

    if (role !== undefined) {
      if (typeof role !== 'string' || !ROLES.has(role)) {
        res.status(400).json({ error: "role must be 'employee', 'manager', or 'admin'" });
        return;
      }
      updates.role = role as UserRow['role'];
    }
    if (team !== undefined) {
      if (typeof team !== 'string') {
        res.status(400).json({ error: 'team must be a string' });
        return;
      }
      updates.team = team;
    }
    if (managerId !== undefined) {
      if (managerId !== null) {
        if (typeof managerId !== 'string' || managerId === target.id || !(await db.users.findById(managerId))) {
          res.status(400).json({ error: 'managerId must be null or the id of another existing user' });
          return;
        }
      }
      updates.managerId = managerId as string | null;
    }

    const updated = await db.users.updateProfile(target.id, updates);
    res.json(toPublicUser(updated!));
  });

  return router;
}
