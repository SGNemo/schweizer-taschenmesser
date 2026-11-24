/**
 * The one title a document has outside its own page: the plan row's (`plannable.ts`) and a link's (`linkTarget.ts`).
 * PRIVACY: the category's wording only („Vertrag kündigen“, „Ausweis verlängern“), never the document's name, a file
 * name or a custom category's name (the person typed it). A document with a notice period reads as its
 * cancellation, every other one as its end. Pure: no database, no settings.
 */
import { t } from '@/strings';
import { isBuiltin } from './categories';
import { cancelDeadline } from './logic';

/** The wording key of a category: a built-in key, else '' (a custom category's name is the person's text). */
const wordingOf = (category: string): string => (isBuiltin(category) ? category : '');

export const docTitle = (d: Parameters<typeof cancelDeadline>[0] & { category: string }): string =>
  cancelDeadline(d) !== undefined
    ? t.vault.planCancel(wordingOf(d.category))
    : t.vault.planRenew(wordingOf(d.category));
