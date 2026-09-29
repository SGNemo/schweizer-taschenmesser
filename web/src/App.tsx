import { BrowserRouter } from 'react-router';
import { AppRoutes } from './router';
import { UpdatePrompt } from './pwa/UpdatePrompt';

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
      <UpdatePrompt />
    </BrowserRouter>
  );
}
