import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initLang } from '@/core/i18n/lang';
import { initCapturePlatform } from '@/core/platform';
import '@/ui/global.css';
import { CaptureWindow } from './CaptureWindow';

// The capture window is a second entry of the same frontend. It deliberately starts none of the
// app services (sync, notifications, updates, local API): it only opens the local database and
// writes through the module adapters. The main window syncs what it wrote.
// The language was chosen in the main window (same device storage); this only loads its texts.
void Promise.all([initCapturePlatform(), initLang(async () => true)]).then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <CaptureWindow />
    </StrictMode>,
  );
});
