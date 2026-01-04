import { beforeEach, describe, expect, it } from 'vitest';
import {
  bindingsEqual,
  DEFAULT_SHORTCUTS,
  formatShortcutBinding,
  SHORTCUT_PRESETS,
  useKeyboardShortcutsStore,
  VSCODE_SHORTCUTS,
} from './keyboard-shortcuts-store';

describe('keyboard-shortcuts-store', () => {
  beforeEach(() => {
    // Reset the store to default state before each test
    useKeyboardShortcutsStore.setState({
      activePreset: 'default',
      customShortcuts: { ...DEFAULT_SHORTCUTS },
      vimShortcutsEnabled: true,
    });
  });

  describe('formatShortcutBinding', () => {
    it('should return "Not set" for null binding', () => {
      expect(formatShortcutBinding(null)).toBe('Not set');
    });

    it('should format simple key binding', () => {
      const result = formatShortcutBinding({
        key: 'k',
        modifiers: { cmd: true },
      });
      // Result depends on platform, but should contain K
      expect(result).toContain('K');
    });

    it('should format binding with shift modifier', () => {
      const result = formatShortcutBinding({
        key: 'p',
        modifiers: { cmd: true, shift: true },
      });
      expect(result).toContain('P');
    });

    it('should format Enter key', () => {
      const result = formatShortcutBinding({
        key: 'Enter',
        modifiers: { cmd: true },
      });
      expect(result).toContain('↵');
    });
  });

  describe('bindingsEqual', () => {
    it('should return true for two null bindings', () => {
      expect(bindingsEqual(null, null)).toBe(true);
    });

    it('should return false when one is null', () => {
      expect(bindingsEqual({ key: 'k', modifiers: { cmd: true } }, null)).toBe(
        false
      );
    });

    it('should return true for identical bindings', () => {
      const a = { key: 'k', modifiers: { cmd: true, shift: true } };
      const b = { key: 'K', modifiers: { cmd: true, shift: true } };
      expect(bindingsEqual(a, b)).toBe(true);
    });

    it('should return false for different keys', () => {
      const a = { key: 'k', modifiers: { cmd: true } };
      const b = { key: 'p', modifiers: { cmd: true } };
      expect(bindingsEqual(a, b)).toBe(false);
    });

    it('should return false for different modifiers', () => {
      const a = { key: 'k', modifiers: { cmd: true } };
      const b = { key: 'k', modifiers: { cmd: true, shift: true } };
      expect(bindingsEqual(a, b)).toBe(false);
    });
  });

  describe('store actions', () => {
    it('should start with default preset', () => {
      const { activePreset } = useKeyboardShortcutsStore.getState();
      expect(activePreset).toBe('default');
    });

    it('should get shortcut from default preset', () => {
      const { getShortcut } = useKeyboardShortcutsStore.getState();
      const binding = getShortcut('action.command-palette');
      expect(binding?.key).toBe('k');
      expect(binding?.modifiers.cmd).toBe(true);
    });

    it('should change to custom preset when setting shortcut', () => {
      const { setShortcut, activePreset: beforePreset } =
        useKeyboardShortcutsStore.getState();
      expect(beforePreset).toBe('default');

      setShortcut('action.command-palette', {
        key: 'p',
        modifiers: { cmd: true, shift: true },
      });

      const { activePreset: afterPreset, getShortcut } =
        useKeyboardShortcutsStore.getState();
      expect(afterPreset).toBe('custom');

      const binding = getShortcut('action.command-palette');
      expect(binding?.key).toBe('p');
    });

    it('should reset to preset', () => {
      const { setShortcut, resetToPreset } =
        useKeyboardShortcutsStore.getState();

      // Make a custom change
      setShortcut('action.command-palette', {
        key: 'x',
        modifiers: { cmd: true },
      });

      // Reset to vscode preset
      resetToPreset('vscode');

      const { activePreset } = useKeyboardShortcutsStore.getState();
      expect(activePreset).toBe('vscode');

      const binding = useKeyboardShortcutsStore
        .getState()
        .getShortcut('action.command-palette');
      expect(binding?.key).toBe(
        VSCODE_SHORTCUTS['action.command-palette']?.key
      );
    });

    it('should find conflicts', () => {
      const { setShortcut } = useKeyboardShortcutsStore.getState();

      // Set a shortcut that conflicts with another
      setShortcut('nav.data-browser', {
        key: 'k',
        modifiers: { cmd: true },
      });

      const conflicts = useKeyboardShortcutsStore
        .getState()
        .findConflicts('nav.data-browser', {
          key: 'k',
          modifiers: { cmd: true },
        });

      // Should conflict with action.command-palette which defaults to Cmd+K
      expect(conflicts).toContain('action.command-palette');
    });

    it('should export shortcuts', () => {
      const { exportShortcuts } = useKeyboardShortcutsStore.getState();
      const exported = exportShortcuts();

      expect(exported.version).toBe(1);
      expect(exported.preset).toBe('default');
      expect(exported.shortcuts).toBeDefined();
      expect(exported.exportedAt).toBeDefined();
    });

    it('should import shortcuts', () => {
      const { importShortcuts, exportShortcuts } =
        useKeyboardShortcutsStore.getState();

      // Export current state
      const exported = exportShortcuts();

      // Modify and export
      useKeyboardShortcutsStore
        .getState()
        .setShortcut('action.command-palette', {
          key: 'j',
          modifiers: { cmd: true },
        });

      // Import original
      const result = importShortcuts(exported);
      expect(result).toBe(true);

      // Should be back to original
      const binding = useKeyboardShortcutsStore
        .getState()
        .getShortcut('action.command-palette');
      expect(binding?.key).toBe('k');
    });

    it('should reject invalid import', () => {
      const { importShortcuts } = useKeyboardShortcutsStore.getState();

      const result = importShortcuts({
        version: 999, // Invalid version
        preset: 'default',
        shortcuts: DEFAULT_SHORTCUTS,
        exportedAt: new Date().toISOString(),
      });

      expect(result).toBe(false);
    });
  });

  describe('presets', () => {
    it('should have default preset', () => {
      expect(SHORTCUT_PRESETS.default).toBeDefined();
    });

    it('should have vscode preset', () => {
      expect(SHORTCUT_PRESETS.vscode).toBeDefined();
    });

    it('should have sublime preset', () => {
      expect(SHORTCUT_PRESETS.sublime).toBeDefined();
    });

    it('should have all required actions in each preset', () => {
      const requiredActions = [
        'nav.data-browser',
        'action.command-palette',
        'settings.open',
      ];

      for (const preset of Object.values(SHORTCUT_PRESETS)) {
        for (const action of requiredActions) {
          expect(preset[action as keyof typeof preset]).toBeDefined();
        }
      }
    });
  });
});
