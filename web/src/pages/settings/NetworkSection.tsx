import { formatTimestamp, DATE_TIME_NUMERIC } from '@/core/i18n/format';
import { clearNetLog, setKeepNetLog, setNetworkBlocked, useNetLog } from '@/core/net/netlog';
import { useUiStore } from '@/stores/ui';
import { tNet } from '@/strings.netlog';
import { Button, Card, Switch } from '@/ui';
import styles from './settings.module.css';

/** Settings → Verbindungen → "Was ging wohin?": the local connection log and the network block. */
export function NetworkSection() {
  const n = tNet.use();
  const toast = useUiStore((s) => s.toast);
  const { entries, blocked, keep } = useNetLog();
  const hosts = new Set(entries.map((e) => e.host)).size;
  return (
    <Card>
      <div className={styles.form}>
        <p>{n.description}</p>
        <Switch label={n.block} hint={n.blockHint} checked={blocked} onChange={setNetworkBlocked} />
        {blocked ? (
          <p role="status" className={styles.muted}>
            {n.blockedNote}
          </p>
        ) : null}
        <p data-testid="net-summary">{n.summary(entries.length, hosts)}</p>
        {entries.length === 0 ? (
          <p className={styles.muted}>{n.empty}</p>
        ) : (
          <ul className={styles.muted} aria-label={n.listLabel} data-testid="net-log">
            {entries.map((e, i) => (
              <li key={`${e.at}-${i}`}>
                {formatTimestamp(e.at, DATE_TIME_NUMERIC)} · {e.host} · {n.reasons[e.reason]} ·{' '}
                {typeof e.status === 'number' ? n.statusCode(e.status) : n.status[e.status]}
                {e.status === 'native' || e.status === 'blocked' ? '' : ` · ${n.size(e.out, e.in)}`}
              </li>
            ))}
          </ul>
        )}
        <Switch label={n.keep} hint={n.keepHint} checked={keep} onChange={setKeepNetLog} />
        <div className={styles.row}>
          <Button
            disabled={entries.length === 0}
            onClick={() => {
              clearNetLog();
              toast(n.cleared);
            }}
          >
            {n.clear}
          </Button>
        </div>
      </div>
    </Card>
  );
}
