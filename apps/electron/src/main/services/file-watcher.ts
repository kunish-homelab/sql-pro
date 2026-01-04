import type { FileChangeEvent } from '@shared/types';
import type { FSWatcher, WatchEventType } from 'node:fs';
import { watch } from 'node:fs';
import { IPC_CHANNELS } from '@shared/types';
import { BrowserWindow } from 'electron';

/**
 * Service to watch SQLite database files for external changes.
 * When a file change is detected, it notifies the renderer process
 * so that the schema and data can be reloaded.
 */
class FileWatcherService {
  private watchers: Map<string, FSWatcher> = new Map();
  // Debounce timers to avoid multiple rapid-fire events
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>> =
    new Map();
  // Track if we should ignore the next change (for our own writes)
  private ignoredPaths: Set<string> = new Set();
  // Track ignore timeout timers for cleanup
  private ignoreTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  // Debounce delay in milliseconds
  private readonly debounceDelay = 500;

  /**
   * Start watching a database file for changes.
   * @param connectionId The connection ID associated with this file
   * @param dbPath The path to the database file
   */
  watch(connectionId: string, dbPath: string): void {
    // Don't watch if already watching this connection
    if (this.watchers.has(connectionId)) {
      return;
    }

    try {
      const watcher = watch(dbPath, (eventType: WatchEventType) => {
        // Skip if path is in ignored set (our own writes)
        if (this.ignoredPaths.has(dbPath)) {
          return;
        }

        // Debounce the event
        this.debounce(connectionId, dbPath, eventType);
      });

      // Handle watcher errors gracefully
      watcher.on('error', (err) => {
        console.warn(`File watcher error for ${dbPath}:`, err);
        this.unwatch(connectionId);
      });

      this.watchers.set(connectionId, watcher);
    } catch (error) {
      console.warn(`Failed to start file watcher for ${dbPath}:`, error);
    }
  }

  /**
   * Stop watching a database file.
   * @param connectionId The connection ID to stop watching
   */
  unwatch(connectionId: string): void {
    const watcher = this.watchers.get(connectionId);
    if (watcher) {
      watcher.close();
      this.watchers.delete(connectionId);
    }

    // Clear any pending debounce timer
    const timer = this.debounceTimers.get(connectionId);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(connectionId);
    }
  }

  /**
   * Stop watching all files and clean up.
   */
  unwatchAll(): void {
    for (const [connectionId] of this.watchers) {
      this.unwatch(connectionId);
    }

    // Clear all ignore timers
    for (const [, timer] of this.ignoreTimers) {
      clearTimeout(timer);
    }
    this.ignoreTimers.clear();
    this.ignoredPaths.clear();
  }

  /**
   * Temporarily ignore changes to a database file.
   * Use this when the application is making its own changes
   * to prevent false-positive reload triggers.
   * @param dbPath The path to ignore
   * @param duration How long to ignore (ms), default 1000ms
   */
  ignoreChanges(dbPath: string, duration: number = 1000): void {
    // Clear any existing timer for this path
    const existingTimer = this.ignoreTimers.get(dbPath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    this.ignoredPaths.add(dbPath);
    const timer = setTimeout(() => {
      this.ignoredPaths.delete(dbPath);
      this.ignoreTimers.delete(dbPath);
    }, duration);
    this.ignoreTimers.set(dbPath, timer);
  }

  /**
   * Debounce file change events to avoid multiple notifications.
   */
  private debounce(
    connectionId: string,
    dbPath: string,
    eventType: WatchEventType
  ): void {
    // Clear existing timer
    const existingTimer = this.debounceTimers.get(connectionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.debounceTimers.delete(connectionId);
      this.notifyRenderer(connectionId, dbPath, eventType);
    }, this.debounceDelay);

    this.debounceTimers.set(connectionId, timer);
  }

  /**
   * Notify all renderer processes about a file change.
   */
  private notifyRenderer(
    connectionId: string,
    dbPath: string,
    eventType: WatchEventType
  ): void {
    const event: FileChangeEvent = {
      connectionId,
      dbPath,
      eventType: eventType === 'rename' ? 'rename' : 'change',
    };

    // Send to all windows
    const allWindows = BrowserWindow.getAllWindows();
    for (const window of allWindows) {
      if (!window.isDestroyed()) {
        window.webContents.send(IPC_CHANNELS.DB_FILE_CHANGED, event);
      }
    }
  }
}

export const fileWatcherService = new FileWatcherService();
