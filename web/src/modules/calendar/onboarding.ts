import type { OnboardingDef } from '@/core/importer/types';
import { t } from '@/strings';

const s = t.onboarding.reminders;
const template = (id: string, [label, detail]: readonly [string, string], preselected = false) => ({
  id,
  label,
  detail,
  preselected,
});

export const onboarding: OnboardingDef = {
  importers: [
    {
      id: 'templates',
      kind: 'template',
      label: s.templates,
      description: s.templatesHint,
      templates: [
        template('rent', s.rent),
        template('statements', s.statements),
        template('trash', s.trash),
        template('insurance', s.insurance),
        template('energy', s.energy),
        template('tax', s.tax),
        template('dentist', s.dentist),
        template('smoke', s.smoke),
      ],
    },
    {
      id: 'text',
      kind: 'text',
      label: s.text,
      description: s.textHint,
      placeholder: s.placeholder,
    },

    {
      id: 'ics',
      kind: 'file',
      label: t.onboarding.calendar.ics,
      description: t.onboarding.calendar.icsHint,
      accept: '.ics,text/calendar',
    },
    {
      id: 'mail',
      kind: 'connector',
      connectorId: 'google',
      connectorFeature: 'mail',
      label: t.onboarding.mail.calendar,
      description: t.onboarding.mail.hint,
    },
  ],
  load: () => import('./importer'),
};
