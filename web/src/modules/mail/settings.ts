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
  /** A local model (built-in or Ollama on this computer, never a cloud one) may summarise mail. */
  localAi: z.boolean(),
  /** The list offers the filter „Persönlich“ (sender is a person, header logic). */
  offerPersonal: z.boolean(),
  /** The list offers „Alle in den Plan…“ (a preview with ticks). */
  offerPlanAll: z.boolean(),
  /** Rows read as an invoice or payment reminder show their values and one verb („Kopf leer“ 3b). */
  offerInvoices: z.boolean(),
  /** A planned mail whose last message is the person's own shows „Beantwortet? · Erledigt“ (display only). */
  showAnswered: z.boolean(),
  /** Gmail-style keyboard shortcuts on the mail page (`useMailKeys.ts`). */
  shortcuts: z.boolean(),
  /** What „Wartet auf mich“ holds (`queue.ts`): unanswered mail to the person, starred mail, or nothing. */
  waitingRule: z.enum(['reply', 'starred', 'off']),
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
    localAi: false,
    offerPersonal: true,
    offerPlanAll: true,
    offerInvoices: true,
    showAnswered: true,
    shortcuts: true,
    waitingRule: 'reply',
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
      key: 'offerPersonal',
      get label() {
        return t.mail.meta.offerPersonal;
      },
      get help() {
        return t.mail.meta.offerPersonalHelp;
      },
      type: 'boolean',
    },
    {
      key: 'waitingRule',
      get label() {
        return t.mail.meta.waitingRule;
      },
      get help() {
        return t.mail.meta.waitingRuleHelp;
      },
      type: 'select',
      get options() {
        return [
          { value: 'reply', label: t.mail.meta.waitingReply },
          { value: 'starred', label: t.mail.meta.waitingStarred },
          { value: 'off', label: t.mail.meta.waitingOff },
        ];
      },
    },
    {
      key: 'offerPlanAll',
      get label() {
        return t.mail.meta.offerPlanAll;
      },
      get help() {
        return t.mail.meta.offerPlanAllHelp;
      },
      type: 'boolean',
    },
    {
      key: 'offerInvoices',
      get label() {
        return t.mail.meta.offerInvoices;
      },
      get help() {
        return t.mail.meta.offerInvoicesHelp;
      },
      type: 'boolean',
    },
    {
      key: 'showAnswered',
      get label() {
        return t.mail.meta.showAnswered;
      },
      get help() {
        return t.mail.meta.showAnsweredHelp;
      },
      type: 'boolean',
    },
    {
      key: 'shortcuts',
      get label() {
        return t.mail.meta.shortcuts;
      },
      get help() {
        return t.mail.meta.shortcutsHelp;
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
    {
      key: 'localAi',
      get label() {
        return t.mail.meta.localAi;
      },
      get help() {
        return t.mail.meta.localAiHelp;
      },
      type: 'boolean',
    },
  ],
};
