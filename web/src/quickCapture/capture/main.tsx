import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initCapturePlatform } from '@/core/platform';
import '@/ui/global.css';
import { CaptureWindow } from './CaptureWindow';

// The capture window is a second entry of the same frontend. It deliberately starts none of the
// app services (sync, notifications, updates, local API): it only opens the local database and
// writes through the module adapters. The main window syncs what it wrote.
void initCapturePlatform().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <CaptureWindow />
    </StrictMode>,
  );
});
