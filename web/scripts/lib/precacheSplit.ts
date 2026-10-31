/**
 * Which build files leave the service worker's precache (decision: docs/decisions/core.md, numbers:
 * docs/perf/COLD-START-2026-10.md). Pure logic over the bundle graph; vite.config.ts feeds it the output
 * chunks and filters the precache list with the result.
 *
 * Rule: start at the entries and follow every import, static and dynamic, but never step through a
 * dynamic import into an "online root" (a tool's `View.tsx`, the chat view, the password dictionaries).
 * What is reached that way stays precached, so the whole app keeps working offline. Everything else is
 * only reachable through an online root: it loads on first use and the runtime cache keeps it. A file that
 * a precached part also needs is always reached, so it can never go missing offline. The cloud model SDK
 * stays precached: `core/ai/providers/claude.ts` imports it outside its error mapping, so an offline
 * import would show another message than today.
 */

/** Source modules whose chunks load on first use (tested in precacheSplit.test.ts). */
export const ONLINE_ROOTS: readonly RegExp[] = [
  /(^|[\\/])src[\\/]tools[\\/][^\\/]+[\\/]View\.tsx$/,
  /(^|[\\/])src[\\/]modules[\\/]chat[\\/]routes[\\/]ChatView\.tsx$/,
  /node_modules[\\/]@zxcvbn-ts[\\/]/,
];

export const isOnlineRoot = (moduleId: string | null | undefined): boolean =>
  !!moduleId && ONLINE_ROOTS.some((r) => r.test(moduleId));

/** One output chunk, reduced to what the rule needs. */
export interface GraphChunk {
  file: string;
  isEntry: boolean;
  /** Module the chunk stands for (entry / dynamic-import target), if any. */
  facadeModuleId: string | null;
  imports: readonly string[];
  dynamicImports: readonly string[];
  /** CSS and other assets the chunk pulls in. */
  assets: readonly string[];
}

/** Files (chunks and their assets) that are only reachable through an online root. */
export function onlineOnlyFiles(chunks: readonly GraphChunk[], isRoot = isOnlineRoot): string[] {
  const byFile = new Map(chunks.map((c) => [c.file, c]));
  const kept = new Set<string>();
  const stack = chunks.filter((c) => c.isEntry).map((c) => c.file);
  while (stack.length) {
    const file = stack.pop()!;
    if (kept.has(file)) continue;
    kept.add(file);
    const c = byFile.get(file);
    if (!c) continue;
    for (const a of c.assets) kept.add(a);
    stack.push(...c.imports);
    for (const d of c.dynamicImports) {
      if (!isRoot(byFile.get(d)?.facadeModuleId)) stack.push(d);
    }
  }
  const out = new Set<string>();
  for (const c of chunks) {
    if (!kept.has(c.file)) out.add(c.file);
    for (const a of c.assets) if (!kept.has(a)) out.add(a);
  }
  return [...out].sort();
}
