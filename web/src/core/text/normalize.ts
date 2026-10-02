/** Lowercase, strip diacritics – "Übersicht" matches "ubersicht". */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
