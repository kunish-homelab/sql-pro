import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Import after mocking
import { sqlPro } from '@/lib/api';
import { useThemeStore } from './theme-store';

// Mock the API module before importing the store
vi.mock('@/lib/api', () => ({
  sqlPro: {
    app: {
      getPreferences: vi.fn(),
      setPreferences: vi.fn(),
    },
  },
}));

// Mock matchMedia before importing the store
const mockMatchMediaListeners: ((event: { matches: boolean }) => void)[] = [];
let mockMatchesDark = false;

const mockMatchMedia = vi.fn((query: string) => ({
  matches: query === '(prefers-color-scheme: dark)' ? mockMatchesDark : false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn((event: string, callback: () => void) => {
    if (event === 'change') {
      mockMatchMediaListeners.push(callback);
    }
  }),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

// Setup window.matchMedia before importing store
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: mockMatchMedia,
});

describe('theme-store', () => {
  beforeEach(() => {
    // Reset store state
    useThemeStore.setState({ theme: 'system', isLoading: false });

    // Reset mocks
    mockMatchesDark = false;
    mockMatchMediaListeners.length = 0;
    document.documentElement.classList.remove('dark');
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(sqlPro.app.getPreferences).mockResolvedValue({
      success: true,
      preferences: {
        theme: 'system',
        defaultPageSize: 100,
        confirmBeforeApply: true,
        recentConnectionsLimit: 10,
      },
    });
    vi.mocked(sqlPro.app.setPreferences).mockResolvedValue({
      success: true,
    });
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
  });

  describe('initial state', () => {
    it('should have "system" as default theme', () => {
      const { theme } = useThemeStore.getState();
      expect(theme).toBe('system');
    });

    it('should have isLoading as false', () => {
      const { isLoading } = useThemeStore.getState();
      expect(isLoading).toBe(false);
    });
  });

  describe('loadTheme', () => {
    it('should load theme from main process preferences', async () => {
      vi.mocked(sqlPro.app.getPreferences).mockResolvedValue({
        success: true,
        preferences: {
          theme: 'dark',
          defaultPageSize: 100,
          confirmBeforeApply: true,
          recentConnectionsLimit: 10,
        },
      });

      const { loadTheme } = useThemeStore.getState();
      await loadTheme();

      const { theme } = useThemeStore.getState();
      expect(theme).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should set isLoading during load', async () => {
      let resolvePromise: (value: unknown) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      vi.mocked(sqlPro.app.getPreferences).mockImplementation(
        () =>
          promise as Promise<{
            success: boolean;
            preferences: {
              theme: 'system';
              defaultPageSize: number;
              confirmBeforeApply: boolean;
              recentConnectionsLimit: number;
            };
          }>
      );

      const { loadTheme } = useThemeStore.getState();
      const loadPromise = loadTheme();

      expect(useThemeStore.getState().isLoading).toBe(true);

      resolvePromise!({
        success: true,
        preferences: {
          theme: 'system',
          defaultPageSize: 100,
          confirmBeforeApply: true,
          recentConnectionsLimit: 10,
        },
      });
      await loadPromise;

      expect(useThemeStore.getState().isLoading).toBe(false);
    });

    it('should handle API errors gracefully', async () => {
      vi.mocked(sqlPro.app.getPreferences).mockRejectedValue(
        new Error('API Error')
      );

      const { loadTheme } = useThemeStore.getState();
      await loadTheme();

      // Should remain at default theme
      const { theme, isLoading } = useThemeStore.getState();
      expect(theme).toBe('system');
      expect(isLoading).toBe(false);
    });

    it('should handle unsuccessful response', async () => {
      vi.mocked(sqlPro.app.getPreferences).mockResolvedValue({
        success: false,
      });

      const { loadTheme } = useThemeStore.getState();
      await loadTheme();

      const { theme, isLoading } = useThemeStore.getState();
      expect(theme).toBe('system');
      expect(isLoading).toBe(false);
    });
  });

  describe('setTheme', () => {
    it('should update theme to "dark" and persist to main process', async () => {
      const { setTheme } = useThemeStore.getState();
      await setTheme('dark');

      const { theme } = useThemeStore.getState();
      expect(theme).toBe('dark');
      expect(sqlPro.app.setPreferences).toHaveBeenCalledWith({
        preferences: { theme: 'dark' },
      });
    });

    it('should update theme to "light"', async () => {
      const { setTheme } = useThemeStore.getState();
      await setTheme('light');

      const { theme } = useThemeStore.getState();
      expect(theme).toBe('light');
    });

    it('should update theme to "system"', async () => {
      const { setTheme } = useThemeStore.getState();
      await setTheme('dark');
      await setTheme('system');

      const { theme } = useThemeStore.getState();
      expect(theme).toBe('system');
    });

    it('should optimistically update UI before API call completes', async () => {
      let resolvePromise: (value: unknown) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      vi.mocked(sqlPro.app.setPreferences).mockImplementation(
        () => promise as Promise<{ success: boolean }>
      );

      const { setTheme } = useThemeStore.getState();
      const setPromise = setTheme('dark');

      // Theme should be updated immediately (optimistic update)
      expect(useThemeStore.getState().theme).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);

      resolvePromise!({ success: true });
      await setPromise;
    });

    it('should handle API errors gracefully', async () => {
      vi.mocked(sqlPro.app.setPreferences).mockRejectedValue(
        new Error('API Error')
      );

      const { setTheme } = useThemeStore.getState();
      await setTheme('dark');

      // Theme should still be updated (optimistic behavior)
      const { theme } = useThemeStore.getState();
      expect(theme).toBe('dark');
    });
  });

  describe('applyTheme (dark class handling)', () => {
    it('should add "dark" class when theme is "dark"', async () => {
      const { setTheme } = useThemeStore.getState();
      await setTheme('dark');

      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should remove "dark" class when theme is "light"', async () => {
      document.documentElement.classList.add('dark');

      const { setTheme } = useThemeStore.getState();
      await setTheme('light');

      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('should add "dark" class when theme is "system" and system prefers dark', async () => {
      mockMatchesDark = true;
      // Re-mock matchMedia with updated value
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn((query: string) => ({
          matches:
            query === '(prefers-color-scheme: dark)' ? mockMatchesDark : false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      const { setTheme } = useThemeStore.getState();
      await setTheme('system');

      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should remove "dark" class when theme is "system" and system prefers light', async () => {
      document.documentElement.classList.add('dark');
      mockMatchesDark = false;
      // Re-mock matchMedia with updated value
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn((query: string) => ({
          matches:
            query === '(prefers-color-scheme: dark)' ? mockMatchesDark : false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      const { setTheme } = useThemeStore.getState();
      await setTheme('system');

      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('theme transitions', () => {
    it('should correctly transition from light to dark', async () => {
      const { setTheme } = useThemeStore.getState();

      await setTheme('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);

      await setTheme('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should correctly transition from dark to light', async () => {
      const { setTheme } = useThemeStore.getState();

      await setTheme('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);

      await setTheme('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('should correctly handle multiple theme changes', async () => {
      const { setTheme } = useThemeStore.getState();

      await setTheme('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(useThemeStore.getState().theme).toBe('dark');

      await setTheme('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(useThemeStore.getState().theme).toBe('light');

      await setTheme('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(useThemeStore.getState().theme).toBe('dark');
    });
  });

  describe('store API', () => {
    it('should expose getState method', () => {
      expect(typeof useThemeStore.getState).toBe('function');
    });

    it('should expose setState method', () => {
      expect(typeof useThemeStore.setState).toBe('function');
    });

    it('should expose subscribe method', () => {
      expect(typeof useThemeStore.subscribe).toBe('function');
    });

    it('should allow subscribing to state changes', async () => {
      const listener = vi.fn();
      const unsubscribe = useThemeStore.subscribe(listener);

      const { setTheme } = useThemeStore.getState();
      await setTheme('dark');

      expect(listener).toHaveBeenCalled();

      unsubscribe();
    });
  });

  describe('type constraints', () => {
    it('should only accept valid theme values', async () => {
      const { setTheme } = useThemeStore.getState();

      // These should work without type errors
      await setTheme('light');
      expect(useThemeStore.getState().theme).toBe('light');

      await setTheme('dark');
      expect(useThemeStore.getState().theme).toBe('dark');

      await setTheme('system');
      expect(useThemeStore.getState().theme).toBe('system');
    });
  });
});
