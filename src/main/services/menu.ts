import type { MenuAction } from '../../shared/types';
import process from 'node:process';
import { app, BrowserWindow, Menu, shell } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import { checkForUpdates } from './updater';
import { windowManager } from './window-manager';

function sendMenuAction(action: MenuAction): void {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  if (focusedWindow) {
    focusedWindow.webContents.send(IPC_CHANNELS.MENU_ACTION, action);
  }
}

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
                accelerator: 'CmdOrCtrl+,',
                click: () => sendMenuAction('open-settings'),
              },
              {
                label: 'Plugins...',
                accelerator: 'CmdOrCtrl+Shift+P',
                click: () => sendMenuAction('open-plugins'),
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
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => {
            windowManager.createWindow();
          },
        },
        { type: 'separator' },
        {
          label: 'Open Database...',
          accelerator: 'CmdOrCtrl+O',
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
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => sendMenuAction('refresh-schema'),
        },
        { type: 'separator' },
        ...(isMac
          ? []
          : [
              {
                label: 'Settings...',
                accelerator: 'CmdOrCtrl+,',
                click: () => sendMenuAction('open-settings'),
              },
              {
                label: 'Plugins...',
                accelerator: 'CmdOrCtrl+Shift+P',
                click: () => sendMenuAction('open-plugins'),
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
          accelerator: 'CmdOrCtrl+K',
          click: () => sendMenuAction('toggle-command-palette'),
        },
        { type: 'separator' },
        {
          label: 'Data Browser',
          accelerator: 'CmdOrCtrl+1',
          click: () => sendMenuAction('switch-to-data'),
        },
        {
          label: 'SQL Query',
          accelerator: 'CmdOrCtrl+2',
          click: () => sendMenuAction('switch-to-query'),
        },
        { type: 'separator' },
        {
          label: 'Query History',
          accelerator: 'CmdOrCtrl+H',
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
          accelerator: 'CmdOrCtrl+Enter',
          click: () => sendMenuAction('execute-query'),
        },
      ],
    },

    // Window menu
    {
      label: 'Window',
      submenu: [
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+Shift+N',
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
