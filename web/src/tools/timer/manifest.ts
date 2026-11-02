import { t } from '@/strings';
import { formatNumber } from '@/core/i18n/format';
import type { ToolManifest } from '@/core/tools/types';
import { tComfort } from '@/strings.comfort';
import { parseTimerQuery } from './expression';

const tool: ToolManifest = {
  id: 'timer',
  get name() {
    return t.tools.timer.name;
  },
  icon: 'timer',
  get description() {
    return t.tools.timer.description;
  },
  group: 'basis',
  offline: true,
  defaultEnabled: true,
  maturity: 'stable',
  order: 40,
  component: () => import('./Tool'),
  expression(query) {
    const minutes = parseTimerQuery(query);
    if (minutes === undefined) return undefined;
    const label = formatNumber(minutes, { maximumFractionDigits: 2 });
    return {
      text: tComfort.get().tools.timerStart(label),
      async run() {
        // The engine (and its interval) only load when a timer is really started.
        const { useTimer } = await import('./engine');
        const s = useTimer.getState();
        s.setMode('timer');
        s.reset();
        s.setMinutes(minutes);
        s.start();
        const { useUiStore } = await import('@/stores/ui');
        useUiStore.getState().toast(tComfort.get().tools.timerStarted(label));
      },
    };
  },
};
export default tool;
