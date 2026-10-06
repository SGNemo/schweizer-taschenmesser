import { BrowserRouter } from 'react-router';
import { AppRoutes } from './router';
import { AiOffEnforcer } from './layout/AiOffEnforcer';
import { UpdatePrompt } from './pwa/UpdatePrompt';
import { ReadAidProvider } from './ui/ReadAidProvider';

export function App() {
  return (
    <ReadAidProvider>
      <BrowserRouter>
        <AppRoutes />
        <UpdatePrompt />
        <AiOffEnforcer />
      </BrowserRouter>
    </ReadAidProvider>
  );
}
