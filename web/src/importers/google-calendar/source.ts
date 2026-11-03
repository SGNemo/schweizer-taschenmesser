import { best, extOf, head } from '../helpers';
import type { SourceDef } from '../types';

export const source: SourceDef = {
  id: 'google-calendar',
  targets: [{ moduleId: 'calendar', importerId: 'ics' }],
  extensions: ['ics'],
  detect: (files) =>
    best(files, (f) => {
      if (extOf(f.name) !== 'ics' && !/^\s*BEGIN:VCALENDAR/i.test(head(f, 200))) return 0;
      return /(?:^|\/)(?:Calendar|Kalender)\//i.test(f.name) ||
        /X-WR-CALNAME|PRODID:-\/\/Google/i.test(head(f, 4000))
        ? 0.95
        : 0.8;
    }),
};
