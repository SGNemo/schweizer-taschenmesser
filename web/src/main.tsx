import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { startModuleServices } from '@/core/modules/services';
import { startSync } from '@/core/sync/service';
import { startNativeSchedule } from '@/core/notifications/nativeSchedule';
import { startPushSync } from '@/core/notifications/push';
import { initPlatform } from '@/core/platform';
import { startNotificationScheduler } from '@/core/notifications/scheduler';
import { initCore } from '@/core/startup';
import { App } from './App';
import './ui/global.css';

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
  });
});
