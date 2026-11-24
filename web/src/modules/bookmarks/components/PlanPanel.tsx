/**
 * A Merkliste entry's panel under its plan row (planner hub 2, package 4a; hand-off 04): its title and the host as
 * text. Foot: X13 „Im Browser öffnen“ (ghost; the address opens only on this tap) and „Ganz öffnen“. Its „Erledigt“ is
 * the row's tick – the panel has none. It writes nothing.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { PanelGone, PanelLoading, PlanPanelFoot } from '@/core/modules/PlanPanelHost';
import type { PlanPanelProps } from '@/core/modules/types';
import { getPlatform } from '@/core/platform';
import { t } from '@/strings';
import { Button, PanelLine, PanelLines } from '@/ui';
import { hostOf, linkOf } from '../logic';
import { itemRepo } from '../repo';

export default function BookmarkPlanPanel({ id, compact }: PlanPanelProps) {
  const item = useLiveQuery(async () => (await itemRepo.get(id)) ?? null, [id]);
  if (item === undefined) return <PanelLoading />;
  if (item === null) return <PanelGone />;
  const host = hostOf(linkOf(item.url));
  const line = (
    <PanelLines>
      <PanelLine {...(host ? { meta: host } : {})}>{item.title}</PanelLine>
    </PanelLines>
  );
  if (compact) return line;
  // http(s) only, as every opener of the module: a synced or imported address never passed the form's check.
  const url = linkOf(item.url);
  return (
    <>
      {line}
      <PlanPanelFoot>
        {url ? (
          <Button variant="ghost" onClick={() => void getPlatform().app.openUrl(url)}>
            {t.bookmarks.panel.openInBrowser}
          </Button>
        ) : null}
      </PlanPanelFoot>
    </>
  );
}
