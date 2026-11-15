import { BrowserRouter } from 'react-router';
import { useLang } from '@/core/i18n/lang';
import { AppRoutes } from './router';
import { AiOffEnforcer } from './layout/AiOffEnforcer';
import { AppLockGate } from './layout/AppLockGate';
import { UpdatePrompt } from './pwa/UpdatePrompt';
import { ReadAidProvider } from './ui/ReadAidProvider';

/**
 * A language switch re-mounts the UI so every text is read again; data and the URL stay. The app lock
 * wraps every route (detached tool windows included): while locked, no page is mounted.
 */
export function App() {
  const lang = useLang();
  return (
    <ReadAidProvider key={lang}>
      <BrowserRouter>
        <AppLockGate>
          <AppRoutes />
        </AppLockGate>
        <UpdatePrompt />
        <AiOffEnforcer />
      </BrowserRouter>
    </ReadAidProvider>
  );
}
