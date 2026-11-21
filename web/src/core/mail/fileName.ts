/**
 * The name a mail attachment is offered under in the save dialog. The sender chooses the original, so
 * only its last path part is kept (a name with folders would preselect a foreign folder), without
 * control or text-direction characters (they can hide the real ending) and without the characters
 * Windows forbids. The user still sees the name and the ending in the dialog and decides there.
 */
const MAX_LENGTH = 150;
const FALLBACK = 'attachment';
/** Control characters, zero-width and direction marks, line and paragraph separators. */
// eslint-disable-next-line no-control-regex
const HIDDEN = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff]/g;

export function attachmentFileName(name: string): string {
  const last = name.split(/[\\/]/).pop() ?? '';
  const clean = last
    .replace(HIDDEN, '')
    .replace(/[<>:"|?*]/g, '_')
    .replace(/^[\s.]+|[\s.]+$/g, '');
  if (!clean) return FALLBACK;
  if (clean.length <= MAX_LENGTH) return clean;
  const dot = clean.lastIndexOf('.');
  const ending = dot > 0 && clean.length - dot <= 12 ? clean.slice(dot) : '';
  return clean.slice(0, MAX_LENGTH - ending.length) + ending;
}
