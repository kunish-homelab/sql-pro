import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { app, BrowserWindow, nativeImage, session, shell } from 'electron';
import { cleanupIpcHandlers, setupIpcHandlers } from './services/ipc-handlers';
import { createApplicationMenu } from './services/menu';
import { pluginService } from './services/plugin/PluginService';
import { checkForUpdatesOnStartup, initAutoUpdater } from './services/updater';
import { windowManager } from './services/window-manager';

// Inline utilities to avoid @electron-toolkit/utils initialization issues
// Use getter to defer app.isPackaged access until after app ready
const is = {
  get dev() {
    return !app.isPackaged;
  },
};

// React DevTools extension ID from Chrome Web Store
const REACT_DEVTOOLS_ID = 'fmkadmapgofadopljbjfkapdkoienihi';

// Get Chrome extensions directory based on platform
function getChromeExtensionsPath(): string | null {
  const home = homedir();

  if (process.platform === 'darwin') {
    return join(
      home,
      'Library/Application Support/Google/Chrome/Default/Extensions'
    );
  } else if (process.platform === 'win32') {
    return join(
      home,
      'AppData/Local/Google/Chrome/User Data/Default/Extensions'
    );
  } else if (process.platform === 'linux') {
    return join(home, '.config/google-chrome/Default/Extensions');
  }
  return null;
}

// Find the latest version of an extension
function findLatestExtensionVersion(extensionPath: string): string | null {
  if (!existsSync(extensionPath)) return null;

  const versions = readdirSync(extensionPath).filter(
    (name) => !name.startsWith('.')
  );
  if (versions.length === 0) return null;

  // Sort versions and get the latest
  versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  return versions[0];
}

// Install Chrome DevTools extensions (React, etc.) in development mode
async function installDevToolsExtensions(): Promise<void> {
  if (!is.dev) return;

  const extensionsPath = getChromeExtensionsPath();
  if (!extensionsPath) {
    console.warn('Chrome extensions path not found for this platform');
    return;
  }

  const reactDevToolsPath = join(extensionsPath, REACT_DEVTOOLS_ID);
  const latestVersion = findLatestExtensionVersion(reactDevToolsPath);

  if (!latestVersion) {
    console.warn(
      'React DevTools not found in Chrome. Please install it from Chrome Web Store first.'
    );
    return;
  }

  const extensionFullPath = join(reactDevToolsPath, latestVersion);

  try {
    await session.defaultSession.extensions.loadExtension(extensionFullPath, {
      allowFileAccess: true,
    });
  } catch (err) {
    console.warn('Failed to load React DevTools:', err);
  }
}

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

function createWindow(): BrowserWindow {
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

  return mainWindow;
}

// Set app name for development mode
if (is.dev) {
  app.name = 'SQL Pro';
}

app.whenReady().then(async () => {
  setAppUserModelId('com.sqlpro.app');

  // Install DevTools extensions in development mode
  await installDevToolsExtensions();

  // Setup IPC handlers for database operations
  setupIpcHandlers();

  // Initialize plugin system (after IPC handlers are ready)
  const pluginInitResult = await pluginService.initialize();
  if (!pluginInitResult.success) {
    // Log warning but don't block app startup - plugin system is non-critical

    console.warn(
      'Plugin system initialization failed:',
      pluginInitResult.error
    );
  }

  // Initialize auto-updater
  initAutoUpdater();

  // Create native application menu
  createApplicationMenu();

  app.on('browser-window-created', (_, window) => {
    watchWindowShortcuts(window);
  });

  // Create the initial window and register it with the window manager
  const mainWindow = createWindow();
  windowManager.registerWindow(mainWindow);

  app.on('activate', () => {
    // On macOS, re-create a window when the dock icon is clicked and no windows are open
    if (BrowserWindow.getAllWindows().length === 0) {
      const newWindow = createWindow();
      windowManager.registerWindow(newWindow);
    }
  });

  // Check for updates after startup (5 second delay)
  checkForUpdatesOnStartup();
});

app.on('window-all-closed', async () => {
  // Shutdown plugin system (unloads all plugins)
  await pluginService.shutdown();

  cleanupIpcHandlers();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
