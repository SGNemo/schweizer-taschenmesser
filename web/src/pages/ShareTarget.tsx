import { Link, useNavigate, useSearchParams } from 'react-router';
import { enableModule, useModuleStates } from '@/core/modules/activation';
import { getManifest } from '@/core/modules/registry';
import { CaptureForm } from '@/quickCapture/ui/CaptureForm';
import { announceSaved } from '@/quickCapture/ui/announceSaved';
import { t } from '@/strings';
import { Button, Card, EmptyState, Icon, patternStyles, type IconName } from '@/ui';
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

/** Which module the shared content is sent to; modules that are switched off can be switched on right here. */
const TARGETS: Target[] = [
  {
    module: 'bookmarks',
    get label() {
      return t.share.toBookmarks;
    },
    icon: 'bookmark',
    to: (c) => `/bookmarks?${q({ title: c.title, text: c.text, url: c.url })}`,
  },
  {
    module: 'notes',
    get label() {
      return t.share.toNote;
    },
    icon: 'note',
    to: (c) => `/notes?${q({ new: '1', title: c.title, text: c.text || c.url })}`,
  },
  {
    module: 'todos',
    get label() {
      return t.share.toTodo;
    },
    icon: 'checklist',
    to: (c) => `/todos?${q({ new: '1', title: c.title || c.text || c.url })}`,
  },
];

/** `/share`: the neutral target of the PWA share sheet – you choose where the content goes. */
export function ShareTarget() {
  const [params] = useSearchParams();
  const states = useModuleStates();
  const navigate = useNavigate();
  const content = sharedContent(params);
  // The link is dropped when the text already contains it.
  const parts = [content.title, content.text, content.url].filter(
    (v, i, all) =>
      v &&
      all.indexOf(v) === i &&
      !all.some((o) => o && o !== v && o.includes(v) && v === content.url),
  );
  const has = content.title || content.text || content.url;

  return (
    <>
      <div className={styles.header}>
        <div>
          <h1>{t.share.title}</h1>
          <p className={styles.lead}>{t.share.intro}</p>
        </div>
      </div>
      {!has ? (
        <EmptyState title={t.share.nothing} />
      ) : (
        <>
          <Card title={t.share.content}>
            <p data-testid="shared-content" style={{ overflowWrap: 'anywhere' }}>
              {parts.join('\n')}
            </p>
          </Card>
          <Card title={t.quickCapture.share.suggestion}>
            <CaptureForm
              initialText={parts.join(' ')}
              extra={{ note: parts.join('\n') }}
              onSaved={(saved) => {
                announceSaved(saved);
                void navigate('/');
              }}
            />
          </Card>
          <h2>{t.quickCapture.share.or}</h2>
          <ul className={styles.list} aria-label={t.share.where}>
            {states
              ? TARGETS.map((x) => (
                  <Card as="li" key={x.module}>
                    {states[x.module] ? (
                      <Link to={x.to(content)} data-testid={`share-${x.module}`}>
                        <Icon name={x.icon} size={18} /> {x.label}
                      </Link>
                    ) : (
                      <span className={patternStyles.hstack}>
                        <span data-testid={`share-${x.module}-off`}>
                          <Icon name={x.icon} size={18} /> {x.label}
                        </span>
                        <Button
                          aria-label={`${t.share.enable}: ${x.label}`}
                          onClick={() => {
                            const m = getManifest(x.module);
                            if (m) void enableModule(m);
                          }}
                        >
                          {t.actions.enable}
                        </Button>
                      </span>
                    )}
                  </Card>
                ))
              : null}
          </ul>
        </>
      )}
    </>
  );
}
