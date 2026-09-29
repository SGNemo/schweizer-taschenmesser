import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allManifests } from '@/core/modules/registry';
import { buildStores } from './schema';
import snapshot from './schema.snapshot.json';

// Vitest runs with the project root as cwd (also when started via scripts/db-bump.mjs).
const snapshotPath = resolve(process.cwd(), 'src/core/db/schema.snapshot.json');

describe('database schema snapshot', () => {
  it('matches the stores derived from all module manifests', () => {
    const stores = buildStores(allManifests);
    const same = JSON.stringify(stores) === JSON.stringify(snapshot.stores);

    if (process.env.UPDATE_SCHEMA_SNAPSHOT === '1') {
      if (!same) {
        // First-ever snapshot keeps version 1; every later change bumps the Dexie version.
        const version =
          Object.keys(snapshot.stores).length === 0 ? snapshot.version : snapshot.version + 1;
        writeFileSync(snapshotPath, JSON.stringify({ version, stores }, null, 2) + '\n');
        console.log(`schema.snapshot.json updated (version ${version})`);
      }
      return;
    }

    expect(
      stores,
      'Dexie stores changed. Run `npm run db:bump` to bump the DB version and update the snapshot.',
    ).toEqual(snapshot.stores);
  });
});
