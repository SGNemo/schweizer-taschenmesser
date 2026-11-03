import type { ModuleAutomation } from '@/core/automation/module';

const SESSION = { fields: { date: 'date', startTime: 'time', note: 'text' } } as const;

/** Reports a started session (no end time yet); rules cannot start or stop the clock. */
export const automation: ModuleAutomation = {
  watch: { session: SESSION },
  events: { 'timetrack.started': SESSION },
  derive: (signal, base) =>
    signal.table === 'timetrack_session' && signal.kind === 'created' && !signal.data?.endTime
      ? [{ ...base, type: 'timetrack.started', key: `started:${signal.id}` }]
      : [],
};

export default automation;
