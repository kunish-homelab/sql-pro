import type { ElectronAPI } from '@electron-toolkit/preload';
import type { SqlProAPI } from '../../../preload/index';

declare global {
  interface Window {
    electron: ElectronAPI;
    sqlPro: SqlProAPI;
  }
}

// Vite worker import type declarations
declare module 'monaco-editor/esm/vs/editor/editor.worker?worker' {
  const workerConstructor: {
    new (): Worker;
  };
  export default workerConstructor;
}

export {};
