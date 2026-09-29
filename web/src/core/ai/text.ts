/** Lowercase, strip diacritics, ß → ss: "Übersicht" and "ubersicht" compare equal. */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').toLowerCase();
}
