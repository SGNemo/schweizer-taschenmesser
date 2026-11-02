/**
 * `append` fields of an `update` action: the new text is added after the stored text instead of
 * replacing it ("ergänze die Notiz …"). Runs locally while the preview is prepared; the stored text
 * itself never goes to the model.
 */
export function applyAppend(
  patch: Record<string, unknown>,
  stored: Record<string, unknown>,
  fields: readonly string[] | undefined,
): Record<string, unknown> {
  if (!fields?.length) return patch;
  const out = { ...patch };
  for (const f of fields) {
    const add = out[f];
    const old = stored[f];
    if (typeof add !== 'string' || !add.trim()) continue;
    out[f] =
      typeof old === 'string' && old.trim() ? `${old.trimEnd()}\n\n${add.trim()}` : add.trim();
  }
  return out;
}
