import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { StartDataButton } from '@/core/importer/StartDataButton';
import { getPlatform } from '@/core/platform';
import { t } from '@/strings';
import { Button, EmptyState, Icon, IconButton, ItemList, ItemRow, PageHeader } from '@/ui';
import { LinkEditor, type LinkTarget } from '../components/LinkEditor';
import { groupLinks } from '../logic';
import { linkRepo } from '../repo';
import styles from '@/pages/Page.module.css';

export default function LauncherPage() {
  const links = useLiveQuery(() => linkRepo.active().toArray(), []);
  const [target, setTarget] = useState<LinkTarget>(null);
  const [params, setParams] = useSearchParams();
  const groups = useMemo(() => groupLinks(links ?? []), [links]);

  const openTarget = target ?? (params.get('new') ? { draft: true as const } : null);
  const closeEditor = () => {
    setTarget(null);
    if (params.get('new')) setParams({}, { replace: true });
  };

  return (
    <>
      <PageHeader title={t.launcher.title}>
        <Button variant="primary" onClick={() => setTarget({ draft: true })}>
          <Icon name="plus" size={18} />
          {t.launcher.add}
        </Button>
      </PageHeader>
      {links && links.length === 0 ? (
        <EmptyState title={t.launcher.empty}>
          <StartDataButton moduleId="launcher" />
        </EmptyState>
      ) : null}
      {groups.map(({ group, items }) => (
        <section key={group} aria-label={group || t.launcher.noGroup} className={styles.section}>
          {groups.length > 1 || group ? <h2>{group || t.launcher.noGroup}</h2> : null}
          <ItemList layout="grid" label={group || t.launcher.title}>
            {items.map((l) => (
              <ItemRow
                key={l.id}
                title={l.title}
                meta={l.url}
                onOpen={() => void getPlatform().app.openUrl(l.url)}
                end={
                  <IconButton label={t.launcher.editLink(l.title)} onClick={() => setTarget(l)}>
                    <Icon name="edit" size={18} />
                  </IconButton>
                }
              />
            ))}
          </ItemList>
        </section>
      ))}
      <LinkEditor target={openTarget} onClose={closeEditor} />
    </>
  );
}
