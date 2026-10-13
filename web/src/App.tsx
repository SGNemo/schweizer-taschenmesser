import { BrowserRouter } from 'react-router';
import { useLang } from '@/core/i18n/lang';
import { AppRoutes } from './router';
import { AiOffEnforcer } from './layout/AiOffEnforcer';
import { UpdatePrompt } from './pwa/UpdatePrompt';
import { ReadAidProvider } from './ui/ReadAidProvider';

/** A language switch re-mounts the UI so every text is read again; data and the URL stay. */
export function App() {
  const lang = useLang();
  return (
    <ReadAidProvider key={lang}>
      <BrowserRouter>
        <AppRoutes />
        <UpdatePrompt />
        <AiOffEnforcer />
      </BrowserRouter>
    </ReadAidProvider>
  );
}
