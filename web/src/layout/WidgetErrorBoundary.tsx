import { Component, type ReactNode } from 'react';
import { recordError } from '@/core/diagnostics/errorLog';
import { tDiag } from '@/strings.diagnostics';
import { Button } from '@/ui';

/** One broken home widget shows a calm line inside its card; the other widgets keep running. */
export class WidgetErrorBoundary extends Component<
  { id: string; children: ReactNode },
  { error?: Error }
> {
  override state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error): void {
    recordError(`widget-${this.props.id}`, error);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    const d = tDiag.get().widget;
    return (
      <div role="alert" data-testid="widget-error">
        <p>{d.message}</p>
        <Button onClick={() => this.setState({ error: undefined })}>{d.retry}</Button>
      </div>
    );
  }
}
