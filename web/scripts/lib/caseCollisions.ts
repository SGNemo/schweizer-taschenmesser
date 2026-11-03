/**
 * Paths that differ only in letter case work on Linux and break on Windows and macOS (a checkout
 * folds them into one file; a build there then reads the wrong one). PR #369 was such a case:
 * `cockpit.ts` and `Cockpit.tsx`. Erasable TypeScript, imported by `../check-case-collisions.mjs`.
 */

/** Groups of spellings that name the same file or folder on a case-insensitive file system. */
export function findCaseCollisions(paths: readonly string[]): string[][] {
  const spellings = new Map<string, Set<string>>();
  for (const path of paths) {
    const parts = path.split('/');
    for (let i = 1; i <= parts.length; i++) {
      const prefix = parts.slice(0, i).join('/');
      const key = prefix.toLowerCase();
      const set = spellings.get(key) ?? new Set<string>();
      set.add(prefix);
      spellings.set(key, set);
    }
  }
  return (
    [...spellings.values()]
      .filter((set) => set.size > 1)
      .map((set) => [...set].sort())
      // A collision in a folder name already shows up for every file below it; report the shallowest.
      .filter(
        (group, _i, all) =>
          !all.some(
            (o) =>
              o !== group &&
              o[0]!.length < group[0]!.length &&
              group.every((p) => o.some((q) => p.toLowerCase().startsWith(q.toLowerCase() + '/'))),
          ),
      )
      .sort((a, b) => a[0]!.localeCompare(b[0]!))
  );
}
