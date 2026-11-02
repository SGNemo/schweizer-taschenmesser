import { t } from '@/strings';
import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';

const schema = z.object({
  /** `ask`: external images stay blocked until "Bilder laden"; `always`: load them. */
  images: z.enum(['ask', 'always']),
  cacheBodies: z.boolean(),
});

export type MailSettings = z.output<typeof schema>;

export const settings: ModuleSettings = {
  schema,
  defaults: { images: 'ask', cacheBodies: true },
  get keywords() {
    return [
      t.mail.meta.name,
      'Gmail',
      t.mail.page.labels.INBOX!,
      t.mail.meta.images,
      t.mail.panel.cache,
    ];
  },
  fields: [
    {
      key: 'images',
      get label() {
        return t.mail.meta.images;
      },
      get help() {
        return t.mail.meta.imagesHelp;
      },
      type: 'select',
      get options() {
        return [
          { value: 'ask', label: t.mail.meta.imagesAsk },
          { value: 'always', label: t.mail.meta.imagesAlways },
        ];
      },
    },
    {
      key: 'cacheBodies',
      get label() {
        return t.mail.meta.cacheBodies;
      },
      get help() {
        return t.mail.meta.cacheBodiesHelp;
      },
      type: 'boolean',
    },
  ],
};
