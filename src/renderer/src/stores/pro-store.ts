import type { ProFeature } from '../../../shared/types';
import { create } from 'zustand';
import { sqlPro } from '@/lib/api';

interface ProState {
  // Pro status
  isPro: boolean;
  licenseKey: string | undefined;
  activatedAt: string | undefined;
  expiresAt: string | undefined;
  features: ProFeature[];

  // Loading states
  isLoading: boolean;
  isActivating: boolean;

  // Actions
  loadStatus: () => Promise<void>;
  activate: (licenseKey: string) => Promise<boolean>;
  deactivate: () => Promise<boolean>;
  hasFeature: (feature: ProFeature) => boolean;
  clearStatus: () => void;
}

/**
 * All Pro features that are enabled when Pro is activated.
 */
export const ALL_PRO_FEATURES: ProFeature[] = [
  'ai-nl-to-sql',
  'ai-data-analysis',
  'advanced-export',
  'plugin-system',
  'query-optimizer',
];

/**
 * Default Pro status for non-Pro users.
 */
const DEFAULT_PRO_STATUS: Omit<
  ProState,
  | 'loadStatus'
  | 'activate'
  | 'deactivate'
  | 'hasFeature'
  | 'clearStatus'
  | 'isLoading'
  | 'isActivating'
> = {
  isPro: false,
  licenseKey: undefined,
  activatedAt: undefined,
  expiresAt: undefined,
  features: [],
};

export const useProStore = create<ProState>((set, get) => ({
  ...DEFAULT_PRO_STATUS,
  isLoading: false,
  isActivating: false,

  loadStatus: async () => {
    set({ isLoading: true });
    try {
      const result = await sqlPro.pro.getStatus();
      if (result.success && result.status) {
        set({
          isPro: result.status.isPro,
          licenseKey: result.status.licenseKey,
          activatedAt: result.status.activatedAt,
          expiresAt: result.status.expiresAt,
          features: result.status.features,
        });
      }
    } catch (error) {
      console.error('Failed to load Pro status:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  activate: async (licenseKey: string) => {
    set({ isActivating: true });
    try {
      const result = await sqlPro.pro.activate({ licenseKey });
      if (result.success && result.status) {
        set({
          isPro: result.status.isPro,
          licenseKey: result.status.licenseKey,
          activatedAt: result.status.activatedAt,
          expiresAt: result.status.expiresAt,
          features: result.status.features,
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to activate Pro:', error);
      return false;
    } finally {
      set({ isActivating: false });
    }
  },

  deactivate: async () => {
    set({ isActivating: true });
    try {
      const result = await sqlPro.pro.deactivate();
      if (result.success) {
        set({
          ...DEFAULT_PRO_STATUS,
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to deactivate Pro:', error);
      return false;
    } finally {
      set({ isActivating: false });
    }
  },

  hasFeature: (feature: ProFeature) => {
    const state = get();
    return state.isPro && state.features.includes(feature);
  },

  clearStatus: () =>
    set({
      ...DEFAULT_PRO_STATUS,
    }),
}));
