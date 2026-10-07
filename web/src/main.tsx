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
import { installErrorLog } from '@/core/diagnostics/errorLog';
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
// The UI language (and its texts) is ready before the first render.
void Promise.all([initPlatform(), initLang(hasExistingData)]).then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  void initCore().then(() => {
    startNotificationScheduler();
    startModuleServices();
    startSync();
    startPushSync();
    startNativeSchedule();
    startUpdateChecks();
    startConnectorSync();
    startLocalApi();
    void startQuickCaptureDesktop();
    startAutoBackup();
  });
});
