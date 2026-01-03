import type {
  CheckUnsavedChangesRequest,
  FocusWindowRequest,
} from '@shared/types';
import type { SystemFont } from '@/lib/font-constants';
import { exec } from 'node:child_process';
import process from 'node:process';
import { promisify } from 'node:util';
import { IPC_CHANNELS } from '@shared/types';
import { BrowserWindow, ipcMain } from 'electron';
import { CATEGORY_ORDER, classifyFont } from '@/lib/font-constants';
import { sqlLogger } from '../sql-logger';
import { createHandler } from './utils';

const execAsync = promisify(exec);

/**
 * Get all system fonts with category classification.
 */
async function getSystemFonts(): Promise<SystemFont[]> {
  const platform = process.platform;
  const fontNames = new Set<string>();

  try {
    if (platform === 'darwin') {
      try {
        const { stdout } = await execAsync(
          'fc-list --format="%{family[0]}\\n" 2>/dev/null | sort -u'
        );
        const fcFonts = stdout
          .trim()
          .split('\n')
          .filter((f) => f.length > 0);
        fcFonts.forEach((f) => fontNames.add(f.trim()));
      } catch {
        try {
          const { stdout } = await execAsync(
            'system_profiler SPFontsDataType 2>/dev/null | grep "Full Name:" | cut -d: -f2'
          );
          const spFonts = stdout
            .trim()
            .split('\n')
            .filter((f) => f.length > 0);
          spFonts.forEach((f) => fontNames.add(f.trim()));
        } catch {
          const { stdout } = await execAsync(
            'atsutil fonts -list 2>/dev/null | tail -n +2'
          );
          const atsFonts = stdout
            .trim()
            .split('\n')
            .filter((f) => f.length > 0);
          atsFonts.forEach((f) => fontNames.add(f.trim()));
        }
      }
    } else if (platform === 'linux') {
      const { stdout } = await execAsync(
        'fc-list --format="%{family[0]}\\n" | sort -u'
      );
      const linuxFonts = stdout
        .trim()
        .split('\n')
        .filter((f) => f.length > 0);
      linuxFonts.forEach((f) => fontNames.add(f.trim()));
    } else if (platform === 'win32') {
      const { stdout } = await execAsync(
        'powershell -Command "[System.Reflection.Assembly]::LoadWithPartialName(\'System.Drawing\') | Out-Null; (New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { $_.Name }"'
      );
      const winFonts = stdout
        .trim()
        .split('\n')
        .filter((f) => f.length > 0);
      winFonts.forEach((f) => fontNames.add(f.trim()));
    }
  } catch (error) {
    console.error('Failed to get system fonts:', error);
  }

  const fonts: SystemFont[] = Array.from(fontNames).map((name) => ({
    name,
    category: classifyFont(name),
  }));

  return fonts.sort((a, b) => {
    const catDiff = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
    if (catDiff !== 0) return catDiff;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
}

export function setupSystemHandlers(): void {
  // System: Focus Window
  ipcMain.handle(
    IPC_CHANNELS.SYSTEM_FOCUS_WINDOW,
    createHandler(async (request: FocusWindowRequest) => {
      const window = BrowserWindow.fromId(request.windowId);
      if (window) {
        window.focus();
      }
      return { success: true };
    })
  );

  // System: Get System Fonts
  ipcMain.handle(IPC_CHANNELS.SYSTEM_GET_FONTS, async () => {
    try {
      const fonts = await getSystemFonts();
      return { success: true, fonts };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get fonts',
      };
    }
  });

  // Check Unsaved Changes
  ipcMain.handle(
    IPC_CHANNELS.CHECK_UNSAVED_CHANGES,
    createHandler(async (_request: CheckUnsavedChangesRequest) => {
      return { success: true, hasChanges: false };
    })
  );

  // SQL Logging
  ipcMain.on('sql-execute', (_event, data) => {
    sqlLogger.log(data);
  });
}
