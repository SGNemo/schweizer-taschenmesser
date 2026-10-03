import type { CaptureFields, CaptureType } from '../parser';

/**
 * The module page that opens its full form pre-filled with the typed text (Ctrl+Enter in the quick
 * capture). Only types whose page reads the query are listed; for the others Ctrl+Enter just saves.
 */
export function fullFormPath(
  type: CaptureType,
  fields: Pick<CaptureFields, 'title'>,
  text: string,
): string | undefined {
  const title = encodeURIComponent(fields.title || text.trim());
  switch (type) {
    case 'todo':
      return `/todos?new=1&title=${title}`;
    case 'note':
      return `/notes?new=1&title=${title}`;
    case 'bookmark':
      return `/bookmarks?new=1&text=${encodeURIComponent(text.trim())}`;
    default:
      return undefined;
  }
}
