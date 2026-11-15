import { remotePower } from '@/core/platform/tauri/remotePower';
import { mountCountdown } from './countdown';
import './countdown.css';

// The countdown window before a remote power action: a third entry of the frontend, kept apart
// from the app on purpose (no React, no app module, no database): the shell decides and words
// everything, this page only shows it and can stop it.
mountCountdown(document.getElementById('root')!, remotePower);
