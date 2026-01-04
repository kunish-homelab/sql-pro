import { join } from 'node:path';
import process from 'node:process';
import { app, BrowserWindow, nativeImage } from 'electron';

// Inline utilities to avoid initialization issues
const is = {
  get dev() {
    return !app.isPackaged;
  },
};

// Get the app icon path based on platform
function getIconPath(): string {
  const resourcesPath = is.dev
    ? join(__dirname, '../../../resources')
    : join(process.resourcesPath, 'resources');

  if (process.platform === 'win32') {
    return join(resourcesPath, 'icon.ico');
  } else if (process.platform === 'darwin') {
    return join(resourcesPath, 'icon.icns');
  } else {
    return join(resourcesPath, 'icons/512x512.png');
  }
}

export interface WindowInfo {
  id: string;
  window: BrowserWindow;
  createdAt: Date;
}

/**
 * Manages multiple application windows.
 * Each window is independent and can manage different database connections.
 */
class WindowManager {
  private windows: Map<string, WindowInfo> = new Map();
  private windowIdCounter = 0;

  /**
   * Generate a unique window ID
   */
  private generateWindowId(): string {
    this.windowIdCounter += 1;
    return `window_${this.windowIdCounter}_${Date.now()}`;
  }

  /**
   * Create a new application window
   * @returns The window ID of the newly created window
   */
  createWindow(): string {
    const windowId = this.generateWindowId();

    // Create icon for the window
    const iconPath = getIconPath();
    const icon = nativeImage.createFromPath(iconPath);

    const newWindow = new BrowserWindow({
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

    // Store window info
    const windowInfo: WindowInfo = {
      id: windowId,
      window: newWindow,
      createdAt: new Date(),
    };
    this.windows.set(windowId, windowInfo);

    // Show window when ready
    newWindow.on('ready-to-show', () => {
      newWindow.show();
    });

    // Clean up when window is closed
    newWindow.on('closed', () => {
      this.windows.delete(windowId);
    });

    // Load the app
    if (is.dev && process.env.ELECTRON_RENDERER_URL) {
      newWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    } else {
      newWindow.loadFile(join(__dirname, '../renderer/index.html'));
    }

    return windowId;
  }

  /**
   * Close a specific window by ID
   */
  closeWindow(windowId: string): boolean {
    const windowInfo = this.windows.get(windowId);
    if (!windowInfo) {
      return false;
    }

    windowInfo.window.close();
    return true;
  }

  /**
   * Focus a specific window by ID
   */
  focusWindow(windowId: string): boolean {
    const windowInfo = this.windows.get(windowId);
    if (!windowInfo) {
      return false;
    }

    if (windowInfo.window.isMinimized()) {
      windowInfo.window.restore();
    }
    windowInfo.window.focus();
    return true;
  }

  /**
   * Get a window by ID
   */
  getWindow(windowId: string): BrowserWindow | undefined {
    return this.windows.get(windowId)?.window;
  }

  /**
   * Get all window IDs
   */
  getAllWindowIds(): string[] {
    return Array.from(this.windows.keys());
  }

  /**
   * Get all windows
   */
  getAllWindows(): BrowserWindow[] {
    return Array.from(this.windows.values()).map((info) => info.window);
  }

  /**
   * Get the number of open windows
   */
  getWindowCount(): number {
    return this.windows.size;
  }

  /**
   * Get the focused window ID
   */
  getFocusedWindowId(): string | null {
    for (const [windowId, windowInfo] of this.windows) {
      if (windowInfo.window.isFocused()) {
        return windowId;
      }
    }
    return null;
  }

  /**
   * Get the focused window
   */
  getFocusedWindow(): BrowserWindow | null {
    const focusedId = this.getFocusedWindowId();
    if (focusedId) {
      return this.windows.get(focusedId)?.window || null;
    }
    return null;
  }

  /**
   * Broadcast a message to all windows
   */
  broadcastToAll(channel: string, ...args: unknown[]): void {
    for (const windowInfo of this.windows.values()) {
      if (!windowInfo.window.isDestroyed()) {
        windowInfo.window.webContents.send(channel, ...args);
      }
    }
  }

  /**
   * Send a message to a specific window
   */
  sendToWindow(windowId: string, channel: string, ...args: unknown[]): boolean {
    const windowInfo = this.windows.get(windowId);
    if (!windowInfo || windowInfo.window.isDestroyed()) {
      return false;
    }

    windowInfo.window.webContents.send(channel, ...args);
    return true;
  }

  /**
   * Close all windows
   */
  closeAll(): void {
    for (const windowInfo of this.windows.values()) {
      if (!windowInfo.window.isDestroyed()) {
        windowInfo.window.close();
      }
    }
    this.windows.clear();
  }

  /**
   * Check if a window exists
   */
  hasWindow(windowId: string): boolean {
    return this.windows.has(windowId);
  }

  /**
   * Get window info by ID
   */
  getWindowInfo(windowId: string): WindowInfo | undefined {
    return this.windows.get(windowId);
  }

  /**
   * Register an existing window (useful for the initial window created at app start)
   */
  registerWindow(window: BrowserWindow): string {
    const windowId = this.generateWindowId();

    const windowInfo: WindowInfo = {
      id: windowId,
      window,
      createdAt: new Date(),
    };
    this.windows.set(windowId, windowInfo);

    // Clean up when window is closed
    window.on('closed', () => {
      this.windows.delete(windowId);
    });

    return windowId;
  }
}

// Export singleton instance
export const windowManager = new WindowManager();
