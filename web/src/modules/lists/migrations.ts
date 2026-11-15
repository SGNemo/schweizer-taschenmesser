import type { ModuleManifest } from '@/core/modules/types';

/**
 * Data migrations, keyed by target version.
 * v2: optional item fields `section`, `priceCents`, `recurring`, `category`, `toBuy` and list fields
 * `tripDate`, `place`. Old rows stay valid as they are, the step only records the shape version.
 */
/*
 * v3: optional list fields `icon`, `tone`, `archived`. The fixed shopping list (`shopping-default`) stops being
 * special: it can be renamed, archived and deleted like any list. Nothing is rewritten (no write on every device that
 * would race over sync); a list without the fields shows its kind's icon, no tint, and is not archived.
 */
export const migrations: ModuleManifest['migrations'] = {
  2: async () => {},
  3: async () => {},
};
