import type { OnboardingDef } from '@/core/importer/types';
import { t } from '@/strings';

const s = t.onboarding.reminders;
type TemplateId =
  'rent' | 'statements' | 'trash' | 'insurance' | 'energy' | 'tax' | 'dentist' | 'smoke';
/** Label and detail are read when shown, so they follow a language switch. */
const template = (id: TemplateId, preselected = false) => ({
  id,
  get label() {
    return s[id][0];
  },
  get detail() {
    return s[id][1];
  },
  preselected,
});

export const onboarding: OnboardingDef = {
  importers: [
    {
      id: 'templates',
      kind: 'template',
      get label() {
        return s.templates;
      },
      get description() {
        return s.templatesHint;
      },
      templates: [
        template('rent'),
        template('statements'),
        template('trash'),
        template('insurance'),
        template('energy'),
        template('tax'),
        template('dentist'),
        template('smoke'),
      ],
    },
    {
      id: 'text',
      kind: 'text',
      get label() {
        return s.text;
      },
      get description() {
        return s.textHint;
      },
      get placeholder() {
        return s.placeholder;
      },
    },

    {
      id: 'ics',
      kind: 'file',
      get label() {
        return t.onboarding.calendar.ics;
      },
      get description() {
        return t.onboarding.calendar.icsHint;
      },
      accept: '.ics,text/calendar',
    },
    {
      id: 'mail',
      kind: 'connector',
      connectorId: 'google',
      connectorFeature: 'mail',
      get label() {
        return t.onboarding.mail.calendar;
      },
      get description() {
        return t.onboarding.mail.hint;
      },
    },
  ],
  load: () => import('./importer'),
};
