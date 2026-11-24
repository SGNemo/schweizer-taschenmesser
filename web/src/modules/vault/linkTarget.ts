/**
 * Documents (Unterlagen) as link targets (`contributions.linkTarget`, docs/design/planner-hub-2/CONCEPT.md §1.3):
 * reads only this module's own data, never the network. PRIVACY: the title is the plan row's own title (`docTitle`:
 * the category's wording, „Vertrag kündigen“) – never the document's name, which is the plan row's `detail`, a file
 * name or a custom category's name; a link's label is this title, so the name never reaches `_links`. The id is the
 * document's own: an occurrence key (`<id>:cancel:<date>`), a foreign, malformed or soft-deleted id is `gone`. A
 * document has no „Erledigt“, so the answer carries no `done`.
 */
import type { LinkTarget } from '@/core/modules/types';
import { docTitle, documentRoute } from './plannable';
import { documentRepo } from './repo';

const target: LinkTarget = {
  async resolve(id) {
    const doc = await documentRepo.get(id);
    if (!doc) return { state: 'gone' };
    return { state: 'alive', title: docTitle(doc), to: documentRoute(id) };
  },
};

export default target;
