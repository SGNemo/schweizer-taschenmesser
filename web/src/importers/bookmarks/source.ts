import { best, countAll, extOf, head } from '../helpers';
import type { SourceDef } from '../types';

/** The bookmarks HTML every browser exports (Chrome, Edge, Brave, Firefox, Safari: "Netscape" format). */
export const source: SourceDef = {
  id: 'bookmarks',
  targets: [{ moduleId: 'bookmarks', importerId: 'html' }],
  extensions: ['html', 'htm'],
  detect: (files) =>
    best(files, (f) => {
      if (!['html', 'htm'].includes(extOf(f.name))) return 0;
      const start = head(f, 4000);
      if (/<!DOCTYPE\s+NETSCAPE-Bookmark-file-1>/i.test(start)) return 1;
      return /<DT>\s*<A\s[^>]*HREF=/i.test(start) ? 0.7 : 0;
    }),
  summarize: (files) => ({ bookmarks: countAll(files, /<A\s[^>]*HREF=/gi) }),
};
