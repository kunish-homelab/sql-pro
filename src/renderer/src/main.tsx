import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import {
  initializeElectronStorage,
  isElectronEnvironment,
} from './lib/electron-storage';
import './styles/globals.css';

// Initialize electron storage before rendering the app
// This ensures persisted state is loaded from electron-store
async function bootstrap() {
  if (isElectronEnvironment()) {
    try {
      await initializeElectronStorage();
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
