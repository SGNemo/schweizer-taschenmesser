/**
 * The diagnostics file: app facts, the enabled module ids and the shortened error log. Never settings
 * values, record data, secrets or the data folder path (it contains the user name).
 */
import { getAboutInfo, type AboutInfo } from '@/core/about/info';
import { loadModuleStates } from '@/core/modules/activation';
import { availableManifests } from '@/core/modules/available';
import { getPlatform } from '@/core/platform';
import { toDateString } from '@/core/time/now';
import { errorLog, type LogEntry } from './errorLog';

export interface Diagnostics {
  format: 'nemo-diagnostics';
  version: 1;
  app: Omit<AboutInfo, 'dataDir'>;
  activeModules: string[];
  errors: LogEntry[];
}

export async function buildDiagnostics(): Promise<Diagnostics> {
  const { dataDir: _dataDir, ...app } = await getAboutInfo();
  const manifests = availableManifests();
  const states = await loadModuleStates(manifests);
  return {
    format: 'nemo-diagnostics',
    version: 1,
    app,
    activeModules: manifests.filter((m) => states[m.id]).map((m) => m.id),
    errors: errorLog().slice(),
  };
}

export async function exportDiagnostics(): Promise<'saved' | 'cancelled'> {
  const data = JSON.stringify(await buildDiagnostics(), null, 2);
  return getPlatform().saveFile({
    fileName: `nemo-diagnose-${toDateString(new Date())}.json`,
    data,
    mime: 'application/json',
  });
}
