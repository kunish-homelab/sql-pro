import { create } from 'zustand';

interface ConnectionSwitcherState {
  isOpen: boolean;
  search: string;
  selectedIndex: number;

  // Actions
  open: () => void;
  close: () => void;
  toggle: () => void;
  setSearch: (search: string) => void;
  setSelectedIndex: (index: number) => void;
  moveSelection: (direction: 'up' | 'down', maxIndex: number) => void;
}

export const useConnectionSwitcherStore = create<ConnectionSwitcherState>()(
  (set, get) => ({
    isOpen: false,
    search: '',
    selectedIndex: 0,

    open: () => set({ isOpen: true, search: '', selectedIndex: 0 }),
    close: () => set({ isOpen: false, search: '', selectedIndex: 0 }),
    toggle: () => {
      const { isOpen } = get();
      if (isOpen) {
        get().close();
      } else {
        get().open();
      }
    },

    setSearch: (search) => set({ search, selectedIndex: 0 }),
    setSelectedIndex: (selectedIndex) => set({ selectedIndex }),

    moveSelection: (direction, maxIndex) => {
      const { selectedIndex } = get();
      if (direction === 'up') {
        set({ selectedIndex: Math.max(0, selectedIndex - 1) });
      } else {
        set({ selectedIndex: Math.min(maxIndex, selectedIndex + 1) });
      }
    },
  })
);
