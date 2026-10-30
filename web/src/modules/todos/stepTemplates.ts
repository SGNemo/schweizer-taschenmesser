import { t } from '@/strings';

/** Lower-case, no accents: "Präsentation" and "praesentation" meet the same stem. */
const fold = (s: string): string =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').toLowerCase();

export interface StepProposal {
  steps: readonly string[];
  /** False for the generic template: no keyword of the title matched. */
  matched: boolean;
}

/**
 * Small steps for a task from the local templates of the current language, chosen by keywords in
 * its title. Nothing is sent anywhere and no model is asked: the title only selects a template.
 * Without a keyword the generic three steps are offered.
 */
export function proposeSteps(title: string): StepProposal {
  // Stems match at the start of a word: "form" finds "Formular", not "Information".
  const text = ` ${fold(title).replace(/[^a-z0-9]+/g, ' ')}`;
  for (const set of t.focus.mode.stepSets) {
    if (set.words.some((w) => text.includes(` ${fold(w)}`)))
      return { steps: set.steps, matched: true };
  }
  return { steps: t.focus.mode.stepsTemplate, matched: false };
}
