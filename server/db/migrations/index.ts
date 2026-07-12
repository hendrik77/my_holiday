import type { Migration } from '../migrate';
import { baseline } from './001-baseline';
import { users } from './002-users';

/** All schema migrations, in apply order. Append only — never reorder or edit an applied migration. */
export const migrations: Migration[] = [baseline, users];
