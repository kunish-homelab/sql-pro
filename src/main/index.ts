import { join } from 'node:path';
import process from 'node:process';
import { app, BrowserWindow, nativeImage, shell } from 'electron';
import { cleanupIpcHandlers, setupIpcHandlers } from './services/ipc-handlers';
import { createApplicationMenu } from './services/menu';

// Inline utilities to avoid @electron-toolkit/utils initialization issues
// Use getter to defer app.isPackaged access until after app ready
const is = {
  get dev() {
    return !app.isPackaged;
  },
};

function setAppUserModelId(id: string): void {
  if (process.platform === 'win32') {
    app.setAppUserModelId(id);
  }
}

function watchWindowShortcuts(window: BrowserWindow): void {
  window.webContents.on('before-input-event', (event, input) => {
    // Prevent default refresh shortcuts in production
    if (!is.dev && input.key === 'F5') {
      event.preventDefault();
    }
    if (!is.dev && input.control && input.key === 'r') {
      event.preventDefault();
    }
  });
}

// Get the app icon path based on platform
function getIconPath(): string {
  const resourcesPath = is.dev
    ? join(__dirname, '../../resources')
    : join(process.resourcesPath, 'resources');

  if (process.platform === 'win32') {
    return join(resourcesPath, 'icon.ico');
  } else if (process.platform === 'darwin') {
    return join(resourcesPath, 'icon.icns');
  } else {
    return join(resourcesPath, 'icons/512x512.png');
  }
}

function createWindow(): void {
  // Create icon for the window
  const iconPath = getIconPath();
  const icon = nativeImage.createFromPath(iconPath);

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    icon: icon.isEmpty() ? undefined : icon,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 10 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

// Set app name for development mode
if (is.dev) {
  app.name = 'SQL Pro';
}

app.whenReady().then(() => {
  setAppUserModelId('com.sqlpro.app');

  // Setup IPC handlers for database operations
  setupIpcHandlers();

  // Create native application menu
  createApplicationMenu();

  app.on('browser-window-created', (_, window) => {
    watchWindowShortcuts(window);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  cleanupIpcHandlers();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
