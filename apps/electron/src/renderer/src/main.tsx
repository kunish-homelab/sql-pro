import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import {
  hydrateStores,
  initializeElectronStorage,
  isElectronEnvironment,
} from './lib/electron-storage';
// Import stores to register their hydrators
import './stores/connection-store';
import './stores/diagram-store';
import './stores/settings-store';
import './styles/globals.css';

// Initialize electron storage before rendering the app
// This ensures persisted state is loaded from electron-store
async function bootstrap() {
  if (isElectronEnvironment()) {
    try {
      // Load all persisted data from electron-store into cache
      await initializeElectronStorage();

      // Hydrate all registered stores with cached data
      hydrateStores();
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
