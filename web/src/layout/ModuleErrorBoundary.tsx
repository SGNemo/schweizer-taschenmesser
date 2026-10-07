import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { recordError } from '@/core/diagnostics/errorLog';
import { reportBug } from '@/core/diagnostics/report';
import { disableModule } from '@/core/modules/activation';
import type { ModuleManifest } from '@/core/modules/types';
import { useLang } from '@/core/i18n/lang';
import { tDiag } from '@/strings.diagnostics';
import { useUiStore } from '@/stores/ui';
import { Button, Card } from '@/ui';

interface Props {
  manifest: Pick<ModuleManifest, 'id' | 'name'> & Partial<ModuleManifest>;
  /** Changes when the user navigates: the card then gives way to the page again. */
  resetKey: string;
  children: ReactNode;
}

interface State {
  error?: Error;
  key: string;
}

/**
 * A broken module shows a calm card instead of taking the app down. The error goes into the
 * diagnostics buffer (no data), nothing is sent. Retry, switch the module off (data stays) or report.
 */
class Boundary extends Component<Props & { onDisable: () => void; lang: string }, State> {
  override state: State = { key: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.key ? { error: undefined, key: props.resetKey } : null;
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    recordError(`module-${this.props.manifest.id}`, error);
    void info;
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const d = tDiag.get().card;
    return (
      <Card title={d.title(this.props.manifest.name)} role="alert" data-testid="module-error">
        <p>{d.body}</p>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <Button variant="primary" onClick={() => this.setState({ error: undefined })}>
            {d.retry}
          </Button>
          <Button onClick={this.props.onDisable}>{d.disable}</Button>
          <Button
            onClick={() =>
              void reportBug(`${this.props.manifest.id}: ${error.name}: ${error.message}`)
            }
          >
            {d.report}
          </Button>
        </div>
      </Card>
    );
  }
}

export function ModuleErrorBoundary({ manifest, children }: Omit<Props, 'resetKey'>) {
  const { pathname } = useLocation();
  const lang = useLang();
  const toast = useUiStore((s) => s.toast);
  const onDisable = () =>
    void disableModule(manifest as ModuleManifest, 'keep').then(() =>
      toast(tDiag.get().card.disabled),
    );
  return (
    <Boundary manifest={manifest} resetKey={pathname} lang={lang} onDisable={onDisable}>
      {children}
    </Boundary>
  );
}
