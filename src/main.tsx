import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/heebo/hebrew-400.css';
import '@fontsource/heebo/hebrew-500.css';
import '@fontsource/heebo/hebrew-700.css';
import '@fontsource/heebo/latin-400.css';
import '@fontsource/heebo/latin-700.css';
import '@fontsource/frank-ruhl-libre/hebrew-900.css';
import './ui/styles.css';
import { App } from './ui/App';
import { registerSW } from 'virtual:pwa-register';

registerSW({ immediate: true });
// Ask the browser to keep game history even under storage pressure.
void navigator.storage?.persist?.();

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
