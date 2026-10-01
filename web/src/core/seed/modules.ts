import type { SeedModule } from './types';

/** `src/modules/<id>/seed.ts` of every module, loaded on demand (dev-only code path). */
const loaders = import.meta.glob<{ default: SeedModule }>('../../modules/*/seed.ts');

export const SEED_FILES: string[] = Object.keys(loaders).map(
  (path) => /modules\/([^/]+)\/seed\.ts$/.exec(path)![1]!,
);

export async function loadSeedModule(moduleId: string): Promise<SeedModule | undefined> {
  const loader = loaders[`../../modules/${moduleId}/seed.ts`];
  return loader ? (await loader()).default : undefined;
}
