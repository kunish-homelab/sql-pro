/**
 * Menu Command Plugin for SQL Pro
 *
 * This example plugin demonstrates advanced menu and command functionality:
 *
 * 1. **Multiple Menu Items** - Add multiple items with different configurations
 * 2. **Hierarchical Submenus** - Create nested menu structures
 * 3. **Dynamic Enabling** - Enable/disable menu items based on conditions
 * 4. **Keyboard Shortcuts** - Bind menu items to keyboard accelerators
 * 5. **Command Palette** - Register commands with categories
 * 6. **Persistent Settings** - Save user preferences with the Storage API
 *
 * Use this template when you need to create a plugin that extends the
 * application menu or command palette with multiple actions.
 *
 * @packageDocumentation
 */

import type { PluginContext, PluginModule } from '@sqlpro/plugin-sdk';

// ============================================================================
// Plugin State
// ============================================================================

/**
 * Store cleanup functions returned by API registration methods.
 */
const disposables: Array<() => void> = [];

/**
 * Track whether logging is currently enabled (for dynamic menu item state).
 */
let isLoggingEnabled = false;

/**
 * Track whether dark mode preference is set (for toggle example).
 */
let isDarkModePreferred = false;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format a date for display in notifications.
 */
function formatTime(): string {
  return new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// ============================================================================
// Plugin Lifecycle
// ============================================================================

/**
 * Plugin activation function.
 *
 * This is the main entry point where we register all menu items and commands.
 * The example demonstrates various menu registration patterns and features.
 *
 * @param context - The plugin context containing the API and metadata
 */
export const activate: PluginModule['activate'] = async (
  context: PluginContext
) => {
  const { api, manifest } = context;

  // -------------------------------------------------------------------------
  // Load saved settings from storage
  // -------------------------------------------------------------------------

  // Restore the logging state from previous session
  const savedLoggingState = await api.storage.get<boolean>('isLoggingEnabled');
  isLoggingEnabled = savedLoggingState ?? false;

  // Restore dark mode preference
  const savedDarkMode = await api.storage.get<boolean>('isDarkModePreferred');
  isDarkModePreferred = savedDarkMode ?? false;

  // -------------------------------------------------------------------------
  // Register Commands in the Command Palette
  // -------------------------------------------------------------------------

  // Command 1: Toggle query logging (demonstrates category and toggle state)
  const unregisterToggleLogging = api.ui.registerCommand({
    id: `${manifest.id}.toggleLogging`,
    title: `Menu Command: Toggle Query Logging (${isLoggingEnabled ? 'On' : 'Off'})`,
    shortcut: 'CmdOrCtrl+Alt+L',
    category: 'Logging',
    handler: async () => {
      isLoggingEnabled = !isLoggingEnabled;

      // Persist the setting
      await api.storage.set('isLoggingEnabled', isLoggingEnabled);

      api.ui.showNotification({
        message: `Query logging ${isLoggingEnabled ? 'enabled' : 'disabled'}.`,
        type: isLoggingEnabled ? 'success' : 'info',
        duration: 3000,
      });
    },
  });
  disposables.push(unregisterToggleLogging);

  // Command 2: Show connection status (demonstrates using metadata API)
  const unregisterShowConnection = api.ui.registerCommand({
    id: `${manifest.id}.showConnection`,
    title: 'Menu Command: Show Connection Status',
    shortcut: 'CmdOrCtrl+Alt+C',
    category: 'Database',
    handler: () => {
      const connection = api.metadata.getCurrentConnection();

      if (connection) {
        api.ui.showNotification({
          message: `Connected to: ${connection.filename}\nPath: ${connection.path}\nRead-only: ${connection.isReadOnly ? 'Yes' : 'No'}`,
          type: 'info',
          duration: 5000,
        });
      } else {
        api.ui.showNotification({
          message: 'No database connection active.',
          type: 'warning',
          duration: 3000,
        });
      }
    },
  });
  disposables.push(unregisterShowConnection);

  // Command 3: Quick action (demonstrates simple command)
  const unregisterQuickAction = api.ui.registerCommand({
    id: `${manifest.id}.quickAction`,
    title: 'Menu Command: Quick Action',
    shortcut: 'CmdOrCtrl+Alt+Q',
    category: 'Actions',
    handler: () => {
      api.ui.showNotification({
        message: `Quick action executed at ${formatTime()}`,
        type: 'success',
        duration: 2000,
      });
    },
  });
  disposables.push(unregisterQuickAction);

  // -------------------------------------------------------------------------
  // Register Menu Items - Basic Examples
  // -------------------------------------------------------------------------

  // Menu Item 1: Simple menu item with keyboard shortcut
  const unregisterSimpleItem = api.ui.registerMenuItem({
    id: `${manifest.id}.menu.quickAction`,
    label: '&Quick Action',
    menuPath: 'Plugins/Menu Command',
    shortcut: 'CmdOrCtrl+Alt+Q',
    handler: () => {
      api.ui.showNotification({
        message: `Quick action executed at ${formatTime()}`,
        type: 'success',
        duration: 2000,
      });
    },
  });
  disposables.push(unregisterSimpleItem);

  // Menu Item 2: Menu item that shows connection info
  const unregisterConnectionItem = api.ui.registerMenuItem({
    id: `${manifest.id}.menu.connectionStatus`,
    label: 'Show &Connection Status',
    menuPath: 'Plugins/Menu Command',
    shortcut: 'CmdOrCtrl+Alt+C',
    handler: () => {
      const connection = api.metadata.getCurrentConnection();

      if (connection) {
        api.ui.showNotification({
          message: `Connected to: ${connection.filename}\nPath: ${connection.path}\nRead-only: ${connection.isReadOnly ? 'Yes' : 'No'}`,
          type: 'info',
          duration: 5000,
        });
      } else {
        api.ui.showNotification({
          message: 'No database connection active.',
          type: 'warning',
          duration: 3000,
        });
      }
    },
    // This menu item is only enabled when there's a database connection
    isEnabled: () => {
      const connection = api.metadata.getCurrentConnection();
      return connection !== null;
    },
  });
  disposables.push(unregisterConnectionItem);

  // -------------------------------------------------------------------------
  // Register Menu Items - Settings Submenu
  // -------------------------------------------------------------------------

  // Settings: Toggle logging (demonstrates nested submenu)
  const unregisterLoggingToggle = api.ui.registerMenuItem({
    id: `${manifest.id}.menu.settings.logging`,
    label: `Query &Logging (${isLoggingEnabled ? '✓ On' : 'Off'})`,
    menuPath: 'Plugins/Menu Command/Settings',
    shortcut: 'CmdOrCtrl+Alt+L',
    handler: async () => {
      isLoggingEnabled = !isLoggingEnabled;
      await api.storage.set('isLoggingEnabled', isLoggingEnabled);

      api.ui.showNotification({
        message: `Query logging ${isLoggingEnabled ? 'enabled' : 'disabled'}.`,
        type: isLoggingEnabled ? 'success' : 'info',
        duration: 3000,
      });
    },
  });
  disposables.push(unregisterLoggingToggle);

  // Settings: Toggle dark mode preference (demonstrates toggle pattern)
  const unregisterDarkModeToggle = api.ui.registerMenuItem({
    id: `${manifest.id}.menu.settings.darkMode`,
    label: `&Dark Mode Preference (${isDarkModePreferred ? '✓ On' : 'Off'})`,
    menuPath: 'Plugins/Menu Command/Settings',
    handler: async () => {
      isDarkModePreferred = !isDarkModePreferred;
      await api.storage.set('isDarkModePreferred', isDarkModePreferred);

      api.ui.showNotification({
        message: `Dark mode preference ${isDarkModePreferred ? 'enabled' : 'disabled'}.\nNote: This is an example setting and doesn't actually change the theme.`,
        type: 'info',
        duration: 4000,
      });
    },
  });
  disposables.push(unregisterDarkModeToggle);

  // Settings: Reset all settings
  const unregisterResetSettings = api.ui.registerMenuItem({
    id: `${manifest.id}.menu.settings.reset`,
    label: '&Reset All Settings',
    menuPath: 'Plugins/Menu Command/Settings',
    handler: async () => {
      // Clear all plugin storage
      await api.storage.clear();

      // Reset in-memory state
      isLoggingEnabled = false;
      isDarkModePreferred = false;

      api.ui.showNotification({
        message: 'All Menu Command plugin settings have been reset.',
        type: 'success',
        duration: 3000,
      });
    },
  });
  disposables.push(unregisterResetSettings);

  // -------------------------------------------------------------------------
  // Register Menu Items - Actions Submenu
  // -------------------------------------------------------------------------

  // Action 1: Copy timestamp
  const unregisterCopyTimestamp = api.ui.registerMenuItem({
    id: `${manifest.id}.menu.actions.copyTimestamp`,
    label: 'Copy &Timestamp',
    menuPath: 'Plugins/Menu Command/Actions',
    shortcut: 'CmdOrCtrl+Alt+T',
    handler: () => {
      const timestamp = new Date().toISOString();

      api.ui.showNotification({
        message: `Timestamp: ${timestamp}\n(This would copy to clipboard in a real plugin)`,
        type: 'info',
        duration: 4000,
      });
    },
  });
  disposables.push(unregisterCopyTimestamp);

  // Action 2: Generate UUID (demonstrates useful utility action)
  const unregisterGenerateUUID = api.ui.registerMenuItem({
    id: `${manifest.id}.menu.actions.generateUUID`,
    label: 'Generate &UUID',
    menuPath: 'Plugins/Menu Command/Actions',
    shortcut: 'CmdOrCtrl+Alt+U',
    handler: () => {
      // Simple UUID v4 generation (for demo purposes)
      const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
        /[xy]/g,
        (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        }
      );

      api.ui.showNotification({
        message: `Generated UUID: ${uuid}\n(This would copy to clipboard in a real plugin)`,
        type: 'success',
        duration: 5000,
      });
    },
  });
  disposables.push(unregisterGenerateUUID);

  // Action 3: Show app info (demonstrates metadata API)
  const unregisterShowAppInfo = api.ui.registerMenuItem({
    id: `${manifest.id}.menu.actions.showAppInfo`,
    label: 'Show &App Info',
    menuPath: 'Plugins/Menu Command/Actions',
    handler: () => {
      const appInfo = api.metadata.getAppInfo();
      const pluginInfo = api.metadata.getPluginInfo();

      api.ui.showNotification({
        message: `SQL Pro v${appInfo.version}\nPlatform: ${appInfo.platform} (${appInfo.arch})\nDev Mode: ${appInfo.isDev ? 'Yes' : 'No'}\n\nPlugin: ${pluginInfo.name} v${pluginInfo.version}`,
        type: 'info',
        duration: 6000,
      });
    },
  });
  disposables.push(unregisterShowAppInfo);

  // -------------------------------------------------------------------------
  // Register Menu Items - Help Submenu
  // -------------------------------------------------------------------------

  // Help: About this plugin
  const unregisterAbout = api.ui.registerMenuItem({
    id: `${manifest.id}.menu.help.about`,
    label: '&About Menu Command Plugin',
    menuPath: 'Plugins/Menu Command/Help',
    handler: () => {
      const pluginInfo = api.metadata.getPluginInfo();

      api.ui.showNotification({
        message: `${pluginInfo.name} v${pluginInfo.version}\n\n${pluginInfo.description}\n\nAuthor: ${pluginInfo.author}`,
        type: 'info',
        duration: 8000,
      });
    },
  });
  disposables.push(unregisterAbout);

  // Help: View documentation (demonstrates external link concept)
  const unregisterDocs = api.ui.registerMenuItem({
    id: `${manifest.id}.menu.help.docs`,
    label: 'View &Documentation',
    menuPath: 'Plugins/Menu Command/Help',
    handler: () => {
      api.ui.showNotification({
        message:
          'Documentation: https://github.com/sqlpro/sqlpro-plugins\n\nIn a real plugin, this would open the browser.',
        type: 'info',
        duration: 5000,
      });
    },
  });
  disposables.push(unregisterDocs);

  // -------------------------------------------------------------------------
  // Show activation notification
  // -------------------------------------------------------------------------

  api.ui.showNotification({
    message: `${manifest.name} plugin activated!\nCheck the Plugins > Menu Command menu for options.`,
    type: 'success',
    duration: 4000,
  });
};

/**
 * Plugin deactivation function.
 *
 * Called when the plugin is disabled or the application is shutting down.
 * Cleans up all registered commands and menu items.
 */
export const deactivate: PluginModule['deactivate'] = () => {
  // Call all stored cleanup functions
  for (const dispose of disposables) {
    dispose();
  }

  // Clear the disposables array
  disposables.length = 0;

  // Reset state
  isLoggingEnabled = false;
  isDarkModePreferred = false;
};
