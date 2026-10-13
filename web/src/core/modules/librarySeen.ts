/**
 * "Neu" / "Aktualisiert" marks in the module library. Device-local (localStorage), nothing sent:
 * the library remembers which module versions it has shown. The very first time nothing is marked
 * (an existing installation has seen everything), later a module that was added or whose data
 * `version` went up after an update carries the mark until the library has been looked at once.
 */
import type { ModuleManifest } from './types';

const KEY = 'tm-library-seen';

export type LibraryBadge = 'new' | 'updated';

function read(): Record<string, number> | undefined {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
    return Object.fromEntries(
      Object.entries(raw as Record<string, unknown>).filter(
        (e): e is [string, number] => typeof e[1] === 'number',
      ),
    );
  } catch {
    return undefined;
  }
}

/** Marks for the given modules; empty on the very first look. */
export function libraryBadges(
  manifests: readonly Pick<ModuleManifest, 'id' | 'version'>[],
): Record<string, LibraryBadge> {
  const seen = read();
  if (!seen) return {};
  const out: Record<string, LibraryBadge> = {};
  for (const m of manifests) {
    const before = seen[m.id];
    if (before === undefined) out[m.id] = 'new';
    else if (m.version > before) out[m.id] = 'updated';
  }
  return out;
}

/** The library has been looked at: everything shown so far counts as seen. */
export function markLibrarySeen(
  manifests: readonly Pick<ModuleManifest, 'id' | 'version'>[],
): void {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify(Object.fromEntries(manifests.map((m) => [m.id, m.version]))),
    );
  } catch {
    // Storage may be blocked; the marks are a convenience only.
  }
}

export function clearLibrarySeen(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
