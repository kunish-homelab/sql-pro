import { create } from 'zustand';
import { sqlPro } from '@/lib/api';

type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  isLoading: boolean;
  setTheme: (theme: Theme) => Promise<void>;
  loadTheme: () => Promise<void>;
}

// Apply theme to document
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (theme === 'dark' || (theme === 'system' && systemDark)) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'system',
  isLoading: false,

  loadTheme: async () => {
    set({ isLoading: true });
    try {
      const result = await sqlPro.app.getPreferences();
      if (result.success && result.preferences) {
        const theme = result.preferences.theme || 'system';
        applyTheme(theme);
        set({ theme, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Failed to load theme:', error);
      set({ isLoading: false });
    }
  },

  setTheme: async (theme) => {
    // Optimistically update UI
    applyTheme(theme);
    set({ theme });

    // Persist to main process
    try {
      const result = await sqlPro.app.setPreferences({
        preferences: { theme },
      });
      if (!result.success) {
        // Revert on failure
        const currentTheme = get().theme;
        applyTheme(currentTheme);
        console.error('Failed to save theme:', result.error);
      }
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  },
}));

// Listen for system theme changes
if (typeof window !== 'undefined') {
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => {
      const { theme } = useThemeStore.getState();
      if (theme === 'system') {
        applyTheme('system');
      }
    });
}
