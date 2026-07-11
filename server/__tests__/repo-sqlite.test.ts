import { describeRepoContract } from './repo-contract';
import { createDb } from '../db';
import { loadConfig } from '../config';

describeRepoContract('sqlite (in-memory)', () =>
  createDb(loadConfig({ DB_DRIVER: 'sqlite', DB_PATH: ':memory:' })),
);
