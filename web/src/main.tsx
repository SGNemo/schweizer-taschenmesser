import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initCore } from '@/core/startup';
import { App } from './App';
import './ui/global.css';

void initCore();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
