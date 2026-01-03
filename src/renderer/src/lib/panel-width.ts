/**
 * Panel Width Persistence Hook
 *
 * Manages panel widths with persistence to electron-store via IPC.
 */

import type { RendererPanelWidths } from '@shared/types/renderer-store';
import { useCallback, useEffect, useRef, useState } from 'react';
import { sqlPro } from './api';
import { isElectronEnvironment } from './electron-storage';

// In-memory cache for panel widths
let panelWidthsCache: RendererPanelWidths = {};
let cacheInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Initialize panel widths cache from electron-store
 */
async function initializeCache(): Promise<void> {
  if (cacheInitialized) return;

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      if (isElectronEnvironment()) {
        const response = await sqlPro.rendererStore.get({ key: 'panelWidths' });
        if (response.success && response.data) {
          panelWidthsCache = response.data as RendererPanelWidths;
        }
      } else {
        // Fallback: load from localStorage
        const stored = localStorage.getItem('panel-widths');
        if (stored) {
          panelWidthsCache = JSON.parse(stored);
        }
      }
    } catch (error) {
      console.error('Failed to initialize panel widths cache:', error);
    } finally {
      cacheInitialized = true;
    }
  })();

  return initPromise;
}

/**
 * Get panel width from cache
 */
function getCachedWidth(key: string): number | undefined {
  return panelWidthsCache[key];
}

/**
 * Set panel width in cache and persist
 */
function setCachedWidth(key: string, width: number): void {
  panelWidthsCache[key] = width;

  // Persist asynchronously
  if (isElectronEnvironment()) {
    sqlPro.rendererStore
      .set({
        key: 'panelWidths',
        value: panelWidthsCache,
      })
      .catch((error) => {
        console.error('Failed to persist panel width:', error);
      });
  } else {
    // Fallback: save to localStorage
    try {
      localStorage.setItem('panel-widths', JSON.stringify(panelWidthsCache));
    } catch {
      // Ignore storage errors
    }
  }
}

/**
 * Hook to use a panel width with persistence
 */
export function usePanelWidth(
  key: string,
  defaultWidth: number,
  minWidth: number,
  maxWidth: number
): [number, (width: number) => void] {
  const [width, setWidth] = useState(() => {
    // Try to get from cache first (synchronous)
    const cached = getCachedWidth(key);
    if (cached !== undefined && cached >= minWidth && cached <= maxWidth) {
      return cached;
    }

    // Try localStorage fallback for initial render
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`panel-width-${key}`);
        if (stored) {
          const parsed = Number.parseInt(stored, 10);
          if (
            !Number.isNaN(parsed) &&
            parsed >= minWidth &&
            parsed <= maxWidth
          ) {
            return parsed;
          }
        }
      } catch {
        // Ignore
      }
    }

    return defaultWidth;
  });

  const initialized = useRef(false);

  // Initialize cache and update width if needed
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    initializeCache().then(() => {
      const cached = getCachedWidth(key);
      if (cached !== undefined && cached >= minWidth && cached <= maxWidth) {
        setWidth(cached);
      }
    });
  }, [key, minWidth, maxWidth]);

  // Persist width when it changes
  const persistWidth = useCallback(
    (newWidth: number) => {
      const clampedWidth = Math.min(Math.max(newWidth, minWidth), maxWidth);
      setWidth(clampedWidth);
      setCachedWidth(key, clampedWidth);
    },
    [key, minWidth, maxWidth]
  );

  return [width, persistWidth];
}

/**
 * Initialize all panel widths - call this early in app startup
 */
export async function initializePanelWidths(): Promise<void> {
  return initializeCache();
}
