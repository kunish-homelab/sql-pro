import type { AIProvider, AISettings } from '../../../shared/types';
import { create } from 'zustand';
import { sqlPro } from '@/lib/api';
import { DEFAULT_AI_BASE_URLS } from '../../../shared/types';

interface AIState {
  // Settings
  provider: AIProvider;
  apiKey: string;
  model: string;
  baseUrl: string;
  isConfigured: boolean;

  // Loading states
  isLoading: boolean;
  isSaving: boolean;

  // Actions
  loadSettings: () => Promise<void>;
  saveSettings: (settings: Partial<AISettings>) => Promise<boolean>;
  setProvider: (provider: AIProvider) => void;
  setApiKey: (apiKey: string) => void;
  setModel: (model: string) => void;
  setBaseUrl: (baseUrl: string) => void;
  clearSettings: () => void;
  getEffectiveBaseUrl: () => string;
}

// Default models for each provider
export const DEFAULT_MODELS: Record<AIProvider, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: [
    'claude-sonnet-4-5',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
  ],
};

export const useAIStore = create<AIState>((set, get) => ({
  provider: 'openai',
  apiKey: '',
  model: 'gpt-4o',
  baseUrl: '',
  isConfigured: false,
  isLoading: false,
  isSaving: false,

  loadSettings: async () => {
    set({ isLoading: true });
    try {
      const result = await sqlPro.ai.getSettings();
      if (result.success && result.settings) {
        set({
          provider: result.settings.provider,
          apiKey: result.settings.apiKey,
          model: result.settings.model,
          baseUrl: result.settings.baseUrl || '',
          isConfigured: Boolean(result.settings.apiKey),
        });
      }
    } catch (error) {
      console.error('Failed to load AI settings:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  saveSettings: async (settings) => {
    const state = get();
    const newSettings: AISettings = {
      provider: settings.provider ?? state.provider,
      apiKey: settings.apiKey ?? state.apiKey,
      model: settings.model ?? state.model,
      baseUrl: settings.baseUrl ?? state.baseUrl,
    };

    set({ isSaving: true });
    try {
      const result = await sqlPro.ai.saveSettings({
        settings: newSettings,
      });
      if (result.success) {
        set({
          ...newSettings,
          isConfigured: Boolean(newSettings.apiKey),
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to save AI settings:', error);
      return false;
    } finally {
      set({ isSaving: false });
    }
  },

  setProvider: (provider) => {
    const models = DEFAULT_MODELS[provider];
    set({
      provider,
      model: models[0], // Reset to default model for new provider
      baseUrl: '', // Reset base URL when switching providers
    });
  },

  setApiKey: (apiKey) => set({ apiKey }),

  setModel: (model) => set({ model }),

  setBaseUrl: (baseUrl) => set({ baseUrl }),

  clearSettings: () =>
    set({
      provider: 'openai',
      apiKey: '',
      model: 'gpt-4o',
      baseUrl: '',
      isConfigured: false,
    }),

  getEffectiveBaseUrl: () => {
    const state = get();
    return state.baseUrl || DEFAULT_AI_BASE_URLS[state.provider];
  },
}));
