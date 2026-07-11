import type { Migration } from '../migrate';
import { baseline } from './001-baseline';

/** All schema migrations, in apply order. Append only — never reorder or edit an applied migration. */
export const migrations: Migration[] = [baseline];
