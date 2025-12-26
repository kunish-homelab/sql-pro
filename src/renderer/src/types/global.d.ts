import type { SqlProAPI } from '../../../preload/index';
import type { ElectronAPI } from '@electron-toolkit/preload';

declare global {
  interface Window {
    electron: ElectronAPI;
    sqlPro: SqlProAPI;
  }
}

export {};
