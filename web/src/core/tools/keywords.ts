/** `"a, b ,c"` → `['a','b','c']`: the keyword strings in the catalogs are comma separated. */
export function toolKeywords(list: string): readonly string[] {
  return list
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}
