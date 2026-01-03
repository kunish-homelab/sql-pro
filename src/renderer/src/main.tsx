import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import {
  initializeElectronStorage,
  isElectronEnvironment,
} from './lib/electron-storage';
import { useConnectionStore } from './stores/connection-store';
import { useDiagramStore } from './stores/diagram-store';
import { useSettingsStore } from './stores/settings-store';
import './styles/globals.css';

// Initialize electron storage before rendering the app
// This ensures persisted state is loaded from electron-store
async function bootstrap() {
  if (isElectronEnvironment()) {
    try {
      await initializeElectronStorage();

      // Force rehydrate all persisted stores after cache is populated
      // This is needed because stores are created at module import time,
      // before initializeElectronStorage() is called
      await Promise.all([
        useSettingsStore.persist.rehydrate(),
        useDiagramStore.persist.rehydrate(),
        useConnectionStore.persist.rehydrate(),
      ]);
    } catch (error) {
      console.error('Failed to initialize electron storage:', error);
    }
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

bootstrap();
