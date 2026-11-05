/**
 * Which module a notification came from, by key, for "Später": the entry remembers its module, so it
 * stays silent once that module is switched off. In memory only; a key not seen in this session has
 * no source (its "Später" entry then fires as before).
 */
const MAX_KEYS = 1000;
const sources = new Map<string, string>();

export function noteSource(key: string, moduleId: string): void {
  sources.delete(key);
  sources.set(key, moduleId);
  if (sources.size > MAX_KEYS) sources.delete(sources.keys().next().value!);
}

export const sourceOf = (key: string): string | undefined => sources.get(key);
