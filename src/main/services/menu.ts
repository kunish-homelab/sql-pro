import type { MenuAction, ShortcutPreset } from '@shared/types';
import process from 'node:process';
import {
  bindingToAccelerator,
  DEFAULT_SHORTCUTS,
  IPC_CHANNELS,
} from '@shared/types';
import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron';
import { checkForUpdates } from './updater';
import { windowManager } from './window-manager';

// Current shortcuts state (synced from renderer)
let currentShortcuts: ShortcutPreset = DEFAULT_SHORTCUTS;

/**
 * Get accelerator for a shortcut action
 */
function getAccelerator(action: keyof ShortcutPreset): string | undefined {
  return bindingToAccelerator(currentShortcuts[action]);
}

function sendMenuAction(action: MenuAction): void {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  if (focusedWindow) {
    focusedWindow.webContents.send(IPC_CHANNELS.MENU_ACTION, action);
  }
}

/**
 * Build and set the application menu with current shortcuts
 */
export function createApplicationMenu(): void {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              {
                label: 'Settings...',
                accelerator: getAccelerator('settings.open'),
                click: () => sendMenuAction('open-settings'),
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),

    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'New Window',
          accelerator: getAccelerator('action.new-window'),
          click: () => {
            windowManager.createWindow();
          },
        },
        { type: 'separator' },
        {
          label: 'Open Database...',
          accelerator: getAccelerator('action.open-database'),
          click: () => sendMenuAction('open-database'),
        },
        {
          label: 'Close Database',
          accelerator: 'CmdOrCtrl+W',
          click: () => sendMenuAction('close-database'),
        },
        { type: 'separator' },
        {
          label: 'Refresh Schema',
          accelerator: getAccelerator('action.refresh-schema'),
          click: () => sendMenuAction('refresh-schema'),
        },
        {
          label: 'Refresh Table',
          accelerator: getAccelerator('action.refresh-table'),
          click: () => sendMenuAction('refresh-table'),
        },
        { type: 'separator' },
        ...(isMac
          ? []
          : [
              {
                label: 'Settings...',
                accelerator: getAccelerator('settings.open'),
                click: () => sendMenuAction('open-settings'),
              },
              { type: 'separator' as const },
            ]),
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },

    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac
          ? [
              { role: 'pasteAndMatchStyle' as const },
              { role: 'delete' as const },
              { role: 'selectAll' as const },
            ]
          : [
              { role: 'delete' as const },
              { type: 'separator' as const },
              { role: 'selectAll' as const },
            ]),
      ],
    },

    // View menu
    {
      label: 'View',
      submenu: [
        {
          label: 'Command Palette...',
          accelerator: getAccelerator('action.command-palette'),
          click: () => sendMenuAction('toggle-command-palette'),
        },
        { type: 'separator' },
        {
          label: 'Data Browser',
          accelerator: getAccelerator('nav.data-browser'),
          click: () => sendMenuAction('switch-to-data'),
        },
        {
          label: 'SQL Query',
          accelerator: getAccelerator('nav.query-editor'),
          click: () => sendMenuAction('switch-to-query'),
        },
        {
          label: 'Schema Compare',
          accelerator: getAccelerator('nav.schema-compare'),
          click: () => sendMenuAction('switch-to-schema-compare'),
        },
        { type: 'separator' },
        {
          label: 'Query History',
          accelerator: getAccelerator('view.toggle-history'),
          click: () => sendMenuAction('toggle-history'),
        },
        { type: 'separator' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },

    // Query menu
    {
      label: 'Query',
      submenu: [
        {
          label: 'Execute Query',
          accelerator: getAccelerator('action.execute-query'),
          click: () => sendMenuAction('execute-query'),
        },
        { type: 'separator' },
        {
          label: 'View Unsaved Changes',
          accelerator: getAccelerator('action.view-changes'),
          click: () => sendMenuAction('view-changes'),
        },
      ],
    },

    // Window menu
    {
      label: 'Window',
      submenu: [
        {
          label: 'New Window',
          accelerator: getAccelerator('action.new-window'),
          click: () => {
            windowManager.createWindow();
          },
        },
        { type: 'separator' },
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const },
              { type: 'separator' as const },
              { role: 'window' as const },
            ]
          : [{ role: 'close' as const }]),
      ],
    },

    // Help menu
    {
      role: 'help',
      submenu: [
        {
          label: 'Keyboard Shortcuts',
          accelerator: getAccelerator('help.shortcuts'),
          click: () => sendMenuAction('show-shortcuts'),
        },
        { type: 'separator' },
        {
          label: 'Check for Updates...',
          click: () => {
            checkForUpdates(false);
          },
        },
        { type: 'separator' },
        {
          label: 'Learn More',
          click: async () => {
            await shell.openExternal('https://github.com/nicepkg/sql-pro');
          },
        },
        {
          label: 'Report Issue',
          click: async () => {
            await shell.openExternal(
              'https://github.com/nicepkg/sql-pro/issues'
            );
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * Update shortcuts and rebuild menu
 */
export function updateShortcuts(shortcuts: ShortcutPreset): void {
  currentShortcuts = shortcuts;
  createApplicationMenu();
}

/**
 * Register IPC handler for shortcuts sync
 */
export function registerShortcutsHandler(): void {
  ipcMain.handle(
    IPC_CHANNELS.SHORTCUTS_UPDATE,
    (_event, payload: { shortcuts: ShortcutPreset }) => {
      updateShortcuts(payload.shortcuts);
      return { success: true };
    }
  );
}
