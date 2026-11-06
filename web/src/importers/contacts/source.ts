import { best, countAll, extOf, head } from '../helpers';
import type { SourceDef } from '../types';

/**
 * Contacts as vCard (`.vcf`): Google Contacts (also `Takeout/Contacts/…`), Apple Contacts, Outlook,
 * Android. The people module keeps birthdays, so it reads the cards that carry a `BDAY`.
 */
export const source: SourceDef = {
  id: 'contacts',
  targets: [{ moduleId: 'people', importerId: 'file' }],
  extensions: ['vcf', 'vcard'],
  detect: (files) =>
    best(files, (f) =>
      /^\s*BEGIN:VCARD/i.test(head(f, 200))
        ? 1
        : ['vcf', 'vcard'].includes(extOf(f.name))
          ? 0.6
          : 0,
    ),
  summarize: (files) => ({ contacts: countAll(files, /^BEGIN:VCARD/gim) }),
};
