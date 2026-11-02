import { t } from '@/strings';
import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';

const schema = z.object({
  /** `ask`: external images stay blocked until "Bilder laden"; `always`: load them. */
  images: z.enum(['ask', 'always']),
  cacheBodies: z.boolean(),
  /** Ask before archiving and labelling (the trash and sending always ask). */
  confirmMoves: z.boolean(),
  /** New-mail notifications: off until switched on (`notifyService.ts` polls, `notifications.ts` tells). */
  notify: z.boolean(),
  /** Minutes between two looks (5, 15, 30, 60). */
  notifyEvery: z.enum(['5', '15', '30', '60']),
  /** Label ids that count (edited in the mail settings dialog, which knows the labels). */
  notifyLabels: z.array(z.string()),
  /** Sender names in the notification; off = only the count. */
  notifyNames: z.boolean(),
});

export type MailSettings = z.output<typeof schema>;

export const settings: ModuleSettings = {
  schema,
  defaults: {
    images: 'ask',
    cacheBodies: true,
    confirmMoves: true,
    notify: false,
    notifyEvery: '15',
    notifyLabels: ['INBOX'],
    notifyNames: false,
  },
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
    {
      key: 'confirmMoves',
      get label() {
        return t.mail.meta.confirmMoves;
      },
      get help() {
        return t.mail.meta.confirmMovesHelp;
      },
      type: 'boolean',
    },
    {
      key: 'notify',
      get label() {
        return t.mail.meta.notify;
      },
      get help() {
        return t.mail.meta.notifyHelp;
      },
      type: 'boolean',
    },
    {
      key: 'notifyEvery',
      get label() {
        return t.mail.meta.notifyEvery;
      },
      type: 'select',
      get options() {
        return [
          { value: '5', label: t.mail.meta.every5 },
          { value: '15', label: t.mail.meta.every15 },
          { value: '30', label: t.mail.meta.every30 },
          { value: '60', label: t.mail.meta.every60 },
        ];
      },
    },
    {
      key: 'notifyNames',
      get label() {
        return t.mail.meta.notifyNames;
      },
      get help() {
        return t.mail.meta.notifyNamesHelp;
      },
      type: 'boolean',
    },
  ],
};
