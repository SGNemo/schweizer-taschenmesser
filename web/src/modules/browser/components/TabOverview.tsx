import { t } from '@/strings';
import { Button, Icon, IconButton } from '@/ui';
import { displayUrl, hostOf } from '../lib/urlPolicy';
import type { Tab } from '../tabsStore';
import styles from './TabOverview.module.css';

const label = (tab: Tab): string =>
  tab.title || (tab.opened ? displayUrl(tab.url) : t.browser.toolbar.untitled);

const monogram = (tab: Tab): string =>
  (hostOf(tab.url) ?? label(tab))
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .charAt(0)
    .toUpperCase() || '·';

/**
 * All open tabs as cards: title, site and a monogram tile in the module hue, or the preview picture when
 * the setting is on. One click switches to the tab, the × closes it. Private tabs are marked in words
 * and never get a picture.
 */
export function TabOverview({
  tabs,
  activeId,
  previews,
  onPick,
  onClose,
  onNew,
}: {
  tabs: Tab[];
  activeId: number | null;
  previews: Record<string, string>;
  onPick: (id: number) => void;
  onClose: (id: number) => void;
  onNew: () => void;
}) {
  return (
    <div className={styles.wrap}>
      <h2>{t.browser.tabs.title}</h2>
      {tabs.length === 0 ? <p className={styles.muted}>{t.browser.tabs.none}</p> : null}
      <ul className={styles.grid}>
        {tabs.map((x) => (
          <li
            key={x.id}
            className={`${styles.card} ${x.id === activeId ? styles.active : ''}`}
            data-testid="tab-card"
          >
            <button
              type="button"
              className={styles.pick}
              aria-current={x.id === activeId ? 'page' : undefined}
              onClick={() => onPick(x.id)}
            >
              <span className={styles.media} aria-hidden="true">
                {!x.isPrivate && previews[x.url] ? (
                  <img src={previews[x.url]} alt="" className={styles.image} />
                ) : (
                  <span className={styles.monogram}>{x.isPrivate ? '◐' : monogram(x)}</span>
                )}
              </span>
              <span className={styles.title}>{label(x)}</span>
              <span className={styles.meta}>
                {[x.isPrivate ? t.browser.tabs.private : undefined, hostOf(x.url)]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </button>
            <span className={styles.close}>
              <IconButton label={t.browser.tabs.close(label(x))} onClick={() => onClose(x.id)}>
                <Icon name="close" />
              </IconButton>
            </span>
          </li>
        ))}
      </ul>
      <div>
        <Button onClick={onNew}>
          <Icon name="plus" size={18} />
          {t.browser.tabs.new}
        </Button>
      </div>
    </div>
  );
}
