import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { startModuleServices } from '@/core/modules/services';
import { startSync } from '@/core/sync/service';
import { startNotificationScheduler } from '@/core/notifications/scheduler';
import { initCore } from '@/core/startup';
import { App } from './App';
import './ui/global.css';

void initCore().then(() => {
  startNotificationScheduler();
  startModuleServices();
  startSync();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
