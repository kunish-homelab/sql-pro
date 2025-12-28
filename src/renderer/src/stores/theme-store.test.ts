import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Import the store after mocking
import { useThemeStore } from './theme-store';

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
    useThemeStore.setState({ theme: 'system' });

    // Reset mocks
    mockMatchesDark = false;
    mockMatchMediaListeners.length = 0;
    document.documentElement.classList.remove('dark');
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
  });

  describe('initial state', () => {
    it('should have "system" as default theme', () => {
      const { theme } = useThemeStore.getState();
      expect(theme).toBe('system');
    });
  });

  describe('setTheme', () => {
    it('should update theme to "dark"', () => {
      const { setTheme } = useThemeStore.getState();
      setTheme('dark');

      const { theme } = useThemeStore.getState();
      expect(theme).toBe('dark');
    });

    it('should update theme to "light"', () => {
      const { setTheme } = useThemeStore.getState();
      setTheme('light');

      const { theme } = useThemeStore.getState();
      expect(theme).toBe('light');
    });

    it('should update theme to "system"', () => {
      const { setTheme } = useThemeStore.getState();
      setTheme('dark');
      setTheme('system');

      const { theme } = useThemeStore.getState();
      expect(theme).toBe('system');
    });
  });

  describe('applyTheme (dark class handling)', () => {
    it('should add "dark" class when theme is "dark"', () => {
      const { setTheme } = useThemeStore.getState();
      setTheme('dark');

      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should remove "dark" class when theme is "light"', () => {
      document.documentElement.classList.add('dark');

      const { setTheme } = useThemeStore.getState();
      setTheme('light');

      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('should add "dark" class when theme is "system" and system prefers dark', () => {
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
      setTheme('system');

      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should remove "dark" class when theme is "system" and system prefers light', () => {
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
      setTheme('system');

      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('theme transitions', () => {
    it('should correctly transition from light to dark', () => {
      const { setTheme } = useThemeStore.getState();

      setTheme('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);

      setTheme('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should correctly transition from dark to light', () => {
      const { setTheme } = useThemeStore.getState();

      setTheme('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);

      setTheme('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('should correctly handle multiple theme changes', () => {
      const { setTheme } = useThemeStore.getState();

      setTheme('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(useThemeStore.getState().theme).toBe('dark');

      setTheme('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(useThemeStore.getState().theme).toBe('light');

      setTheme('dark');
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

    it('should allow subscribing to state changes', () => {
      const listener = vi.fn();
      const unsubscribe = useThemeStore.subscribe(listener);

      const { setTheme } = useThemeStore.getState();
      setTheme('dark');

      expect(listener).toHaveBeenCalled();

      unsubscribe();
    });
  });

  describe('type constraints', () => {
    it('should only accept valid theme values', () => {
      const { setTheme } = useThemeStore.getState();

      // These should work without type errors
      setTheme('light');
      expect(useThemeStore.getState().theme).toBe('light');

      setTheme('dark');
      expect(useThemeStore.getState().theme).toBe('dark');

      setTheme('system');
      expect(useThemeStore.getState().theme).toBe('system');
    });
  });
});
