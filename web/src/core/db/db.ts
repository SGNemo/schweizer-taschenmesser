import Dexie from 'dexie';
import { allManifests } from '@/core/modules/registry';
import { buildStores } from './schema';
import snapshot from './schema.snapshot.json';

export const DB_NAME = 'taschenmesser';

export class TaschenmesserDB extends Dexie {
  constructor(name: string = DB_NAME) {
    super(name);
    // The version comes from the committed snapshot; a unit test guards that the snapshot
    // matches the stores derived from the manifests (fix with `npm run db:bump`).
    this.version(snapshot.version).stores(buildStores(allManifests));
  }
}

/** App-wide database instance. Feature modules must go through createRepo(). */
export const db = new TaschenmesserDB();
