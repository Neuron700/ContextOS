import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './workspace';
import './style.css';
import { registerSW } from 'virtual:pwa-register';
if (!('__TAURI_INTERNALS__' in window) && 'serviceWorker' in navigator) {
  registerSW({ immediate: true, onRegisterError(error) { console.error('Offline support unavailable', error); } });
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
