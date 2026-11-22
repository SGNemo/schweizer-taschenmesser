/**
 * The name a mail attachment is offered under in the save dialog. The sender chooses the original, so
 * it is made one plain file name: path separators and colons become "-" (a name with folders would
 * preselect a foreign folder; "Rechnung 03/2024.pdf" stays readable as "Rechnung 03-2024.pdf"), without
 * control or text-direction characters (they can hide the real ending) and without the characters
 * Windows forbids. The user still sees the name and the ending in the dialog and decides there.
 */
const MAX_LENGTH = 150;
const FALLBACK = 'attachment';
/**
 * Control characters, soft hyphen, direction marks, line and paragraph separators, annotation marks. The
 * joiners U+200C/U+200D stay: emoji sequences and several scripts need them, and they hide no ending.
 */
/* eslint-disable no-control-regex */
const HIDDEN =
  /[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u180e\u200b\u200e\u200f\u2028-\u202e\u2060-\u2069\ufeff\ufff9-\ufffb]/g;
/* eslint-enable no-control-regex */
/** Half of a surrogate pair on its own (the desktop cannot pass such a name on). */
const LONE_SURROGATE = /(?<![\ud800-\udbff])[\udc00-\udfff]|[\ud800-\udbff](?![\udc00-\udfff])/g;

/** Without leading and trailing spaces and dots (Windows drops them silently); a loop, no backtracking. */
function trimEdges(name: string): string {
  const edge = (c: string | undefined) => c === '.' || (c !== undefined && c.trim() === '');
  let start = 0;
  let end = name.length;
  while (start < end && edge(name[start])) start += 1;
  while (end > start && edge(name[end - 1])) end -= 1;
  return name.slice(start, end);
}

export function attachmentFileName(name: string): string {
  const clean = trimEdges(
    // The sender decides the length too: only the end counts, cut on whole characters.
    Array.from(name.slice(-4096))
      .slice(-1024)
      .join('')
      .replace(LONE_SURROGATE, '')
      .replace(HIDDEN, '')
      .replace(/[\\/:]/g, '-')
      .replace(/[<>"|?*]/g, '_'),
  );
  if (!clean) return FALLBACK;
  const chars = Array.from(clean); // code points, so a cut never splits an emoji
  if (chars.length <= MAX_LENGTH) return clean;
  const dot = clean.lastIndexOf('.');
  const ending = dot > 0 && clean.length - dot <= 12 ? clean.slice(dot) : '';
  const head = chars.slice(0, MAX_LENGTH - Array.from(ending).length).join('');
  return (trimEdges(head) || FALLBACK) + ending;
}
