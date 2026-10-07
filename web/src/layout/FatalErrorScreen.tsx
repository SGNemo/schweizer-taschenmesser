import { t } from '@/strings';
import { Component, useMemo, type ReactNode } from 'react';
import { recordError, scrub } from '@/core/diagnostics/errorLog';
import { reportBug } from '@/core/diagnostics/report';
import { createTripleTap, requestSafeModeOnce } from '@/core/safemode/safeMode';
import { tDiag } from '@/strings.diagnostics';
import { Button, Card, Logo } from '@/ui';
import styles from './RecoveryScreen.module.css';

/**
 * Last resort when the whole app fails. A triple tap on the logo (the way into safe mode on a phone
 * without a keyboard) and a visible button both restart with all modules off for one start.
 */
export function FatalErrorScreen({ error }: { error: Error }) {
  const d = tDiag.use().fatal;
  const tap = useMemo(() => createTripleTap(() => requestSafeModeOnce()), []);
  return (
    <main className={styles.page}>
      <div className={styles.panel}>
        <div className={styles.head}>
          <button
            type="button"
            className={styles.logoButton}
            onClick={tap}
            aria-hidden
            tabIndex={-1}
          >
            <Logo size={48} title={t.appName} />
          </button>
          <h1>{d.title}</h1>
        </div>
        <Card role="alert" data-testid="fatal-error">
          <p>{d.body}</p>
          <p className={styles.detail}>
            {error.name}: {scrub(error.message).slice(0, 200)}
          </p>
          <div className={styles.row}>
            <Button variant="primary" onClick={() => location.reload()}>
              {d.reload}
            </Button>
            <Button onClick={() => requestSafeModeOnce()}>{d.safeMode}</Button>
            <Button onClick={() => void reportBug(`${error.name}: ${error.message}`)}>
              {tDiag.get().report.label}
            </Button>
          </div>
          <p className={styles.hint}>{d.safeHint}</p>
        </Card>
      </div>
    </main>
  );
}

export class RootErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  override state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error): void {
    recordError('app', error);
  }

  override render() {
    return this.state.error ? <FatalErrorScreen error={this.state.error} /> : this.props.children;
  }
}
