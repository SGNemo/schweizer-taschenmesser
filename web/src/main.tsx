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
import { getLang, setLang } from '@/core/i18n/lang';
import { App } from './App';
import './ui/global.css';

installErrorLog();
setLang(getLang());

// The platform (browser or native shell) is chosen first: everything below asks `getPlatform()`.
void initPlatform().then(() => {
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
