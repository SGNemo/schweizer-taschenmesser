import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { startAutoBackup } from '@/core/backup/auto';
import { startModuleServices } from '@/core/modules/services';
import { startSync } from '@/core/sync/service';
import { startNativeSchedule } from '@/core/notifications/nativeSchedule';
import { startConnectorSync } from '@/core/connectors/service';
import { startPushSync } from '@/core/notifications/push';
import { initPlatform } from '@/core/platform';
import { startUpdateChecks } from '@/core/update/controller';
import { startNotificationScheduler } from '@/core/notifications/scheduler';
import { initCore } from '@/core/startup';
import { startLocalApi } from '@/core/localapi/service';
import { startQuickCaptureDesktop } from '@/quickCapture/desktop';
import { checkDb } from '@/core/db/health';
import { installErrorLog, recordError } from '@/core/diagnostics/errorLog';
import { initSafeMode, isSafeMode } from '@/core/safemode/safeMode';
import { FatalErrorScreen, RootErrorBoundary } from '@/layout/FatalErrorScreen';
import { RecoveryScreen } from '@/layout/RecoveryScreen';
import { initLang } from '@/core/i18n/lang';
import { DB_NAME } from '@/core/db/db';
import { App } from './App';
import './ui/global.css';

installErrorLog();

/** An installation from before the language choice already has its database. */
async function hasExistingData(): Promise<boolean> {
  if (typeof indexedDB === 'undefined' || !('databases' in indexedDB)) return false;
  const dbs = await indexedDB.databases();
  return dbs.some((d) => d.name === DB_NAME);
}

// The platform (browser or native shell) is chosen first: everything below asks `getPlatform()`.
// The UI language (and its texts) is ready before the first render, the recovery screen included.
void Promise.all([initPlatform(), initLang(hasExistingData)]).then(async () => {
  await initSafeMode();
  const root = createRoot(document.getElementById('root')!);
  // A database that cannot be opened or read gets the recovery screen instead of a blank crash.
  const problem = await checkDb();
  if (problem) {
    recordError('database', `${problem.name}: ${problem.message}`);
    root.render(
      <StrictMode>
        <RecoveryScreen problem={problem} />
      </StrictMode>,
    );
    return;
  }
  root.render(
    <StrictMode>
      <RootErrorBoundary>
        <App />
      </RootErrorBoundary>
    </StrictMode>,
  );
  void initCore()
    .then(() => {
      startNotificationScheduler();
      // Safe mode: no module background work, no connectors, no local API.
      if (!isSafeMode()) {
        startModuleServices();
        startNativeSchedule();
        startConnectorSync();
        startLocalApi();
        void startQuickCaptureDesktop();
      }
      startSync();
      startPushSync();
      startUpdateChecks();
      startAutoBackup();
    })
    .catch(async (e: unknown) => {
      recordError('startup', e);
      const late = await checkDb();
      root.render(
        <StrictMode>
          {late ? (
            <RecoveryScreen problem={late} />
          ) : (
            <FatalErrorScreen error={e instanceof Error ? e : new Error(String(e))} />
          )}
        </StrictMode>,
      );
    });
});
