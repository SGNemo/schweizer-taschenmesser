import { Link, useSearchParams } from 'react-router';
import { useModuleStates } from '@/core/modules/activation';
import { t } from '@/strings';
import { Card, EmptyState, Icon, type IconName } from '@/ui';
import styles from './Page.module.css';

/** What Android's "Share" hands over: `title`, `text` and/or `url` (apps differ in what they fill). */
export function sharedContent(params: URLSearchParams): {
  title: string;
  text: string;
  url: string;
} {
  const text = params.get('text')?.trim() ?? '';
  const url = params.get('url')?.trim() || text.match(/https?:\/\/\S+/)?.[0] || '';
  return { title: params.get('title')?.trim() ?? '', text, url };
}

interface Target {
  module: string;
  label: string;
  icon: IconName;
  to: (c: ReturnType<typeof sharedContent>) => string;
}

const q = (values: Record<string, string>): string =>
  new URLSearchParams(Object.entries(values).filter(([, v]) => v)).toString();

/** Which module the shared content is sent to; only modules that are switched on are offered. */
const TARGETS: Target[] = [
  {
    module: 'bookmarks',
    label: t.share.toBookmarks,
    icon: 'bookmark',
    to: (c) => `/bookmarks?${q({ title: c.title, text: c.text, url: c.url })}`,
  },
  {
    module: 'notes',
    label: t.share.toNote,
    icon: 'note',
    to: (c) => `/notes?${q({ new: '1', title: c.title, text: c.text || c.url })}`,
  },
  {
    module: 'todos',
    label: t.share.toTodo,
    icon: 'checklist',
    to: (c) => `/todos?${q({ new: '1', title: c.title || c.text || c.url })}`,
  },
];

/** `/share`: the neutral target of the PWA share sheet – you choose where the content goes. */
export function ShareTarget() {
  const [params] = useSearchParams();
  const states = useModuleStates();
  const content = sharedContent(params);
  const has = content.title || content.text || content.url;
  const targets = TARGETS.filter((x) => states?.[x.module]);

  return (
    <>
      <div className={styles.header}>
        <div>
          <h1>{t.share.title}</h1>
          <p className={styles.lead}>{t.share.intro}</p>
        </div>
      </div>
      {!has ? (
        <EmptyState icon="external" title={t.share.nothing} />
      ) : (
        <>
          <Card title={t.share.content}>
            <p data-testid="shared-content" style={{ overflowWrap: 'anywhere' }}>
              {[content.title, content.text, content.url]
                .filter((v, i, all) => v && all.indexOf(v) === i)
                .join('\n')}
            </p>
          </Card>
          {states && targets.length === 0 ? <p>{t.share.noTargets}</p> : null}
          <ul className={styles.list} aria-label={t.share.where}>
            {targets.map((x) => (
              <Card as="li" key={x.module}>
                <Link to={x.to(content)} data-testid={`share-${x.module}`}>
                  <Icon name={x.icon} size={18} /> {x.label}
                </Link>
              </Card>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
