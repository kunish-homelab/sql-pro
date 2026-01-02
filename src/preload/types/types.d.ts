import type { ElectronAPI } from '@electron-toolkit/preload';
import type { SqlProAPI } from '../index';

declare global {
  interface Window {
    electron: ElectronAPI;
    sqlPro: SqlProAPI;
  }
}
