import type { SqlProAPI } from '../../../preload/index';
import type { ElectronAPI } from '@electron-toolkit/preload';

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
