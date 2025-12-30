/**
 * Hello World Plugin for SQL Pro
 *
 * This is a minimal example plugin that demonstrates the basic structure
 * of a SQL Pro plugin. It shows how to:
 *
 * 1. Export an `activate` function as the plugin entry point
 * 2. Register a command in the command palette
 * 3. Add a menu item to the application menu
 * 4. Display a notification to the user
 * 5. Export a `deactivate` function for cleanup
 *
 * Use this template as a starting point for your own plugins!
 *
 * @packageDocumentation
 */

import type { PluginContext, PluginModule } from '@sqlpro/plugin-sdk';

// ============================================================================
// Plugin State
// ============================================================================

/**
 * Store cleanup functions returned by API registration methods.
 * These are called during deactivation to clean up the plugin.
 */
const disposables: Array<() => void> = [];

// ============================================================================
// Plugin Lifecycle
// ============================================================================

/**
 * Plugin activation function.
 *
 * This is the main entry point for the plugin. It is called when:
 * - The user enables the plugin
 * - The application starts with this plugin already enabled
 *
 * @param context - The plugin context containing the API and metadata
 */
export const activate: PluginModule['activate'] = (context: PluginContext) => {
  const { api, manifest } = context;

  // -------------------------------------------------------------------------
  // Register a command in the command palette (Cmd/Ctrl+Shift+P)
  // -------------------------------------------------------------------------
  const unregisterCommand = api.ui.registerCommand({
    // Command ID should be unique - prefix with your plugin ID
    id: `${manifest.id}.sayHello`,

    // Title shown in the command palette
    title: 'Hello World: Say Hello',

    // Optional keyboard shortcut (Electron accelerator format)
    shortcut: 'CmdOrCtrl+Shift+H',

    // Optional category for grouping in the command palette
    category: 'Hello World',

    // Handler function called when the command is executed
    handler: () => {
      // Show a success notification
      api.ui.showNotification({
        message: 'Hello, World! Welcome to SQL Pro plugins.',
        type: 'success',
        duration: 5000, // Auto-dismiss after 5 seconds
      });
    },
  });

  // Store the unregister function for cleanup
  disposables.push(unregisterCommand);

  // -------------------------------------------------------------------------
  // Add a menu item to the application menu
  // -------------------------------------------------------------------------
  const unregisterMenuItem = api.ui.registerMenuItem({
    // Menu item ID should be unique
    id: `${manifest.id}.menu.sayHello`,

    // Label shown in the menu (& creates keyboard accelerator)
    label: '&Say Hello',

    // Menu path - creates submenu structure under Plugins menu
    menuPath: 'Plugins/Hello World',

    // Optional keyboard shortcut for the menu item
    shortcut: 'CmdOrCtrl+Shift+H',

    // Handler function called when the menu item is clicked
    handler: () => {
      api.ui.showNotification({
        message: 'Hello from the menu! This is the Hello World plugin.',
        type: 'info',
        duration: 4000,
      });
    },
  });

  // Store the unregister function for cleanup
  disposables.push(unregisterMenuItem);

  // -------------------------------------------------------------------------
  // Add another menu item to show plugin info
  // -------------------------------------------------------------------------
  const unregisterInfoMenuItem = api.ui.registerMenuItem({
    id: `${manifest.id}.menu.showInfo`,
    label: '&About Hello World',
    menuPath: 'Plugins/Hello World',
    handler: () => {
      // Use the metadata API to get plugin and app information
      const pluginInfo = api.metadata.getPluginInfo();
      const appInfo = api.metadata.getAppInfo();

      api.ui.showNotification({
        message: `${pluginInfo.name} v${pluginInfo.version} running on SQL Pro ${appInfo.version} (${appInfo.platform}/${appInfo.arch})`,
        type: 'info',
        duration: 6000,
      });
    },
  });

  disposables.push(unregisterInfoMenuItem);

  // -------------------------------------------------------------------------
  // Show a welcome notification when the plugin activates
  // -------------------------------------------------------------------------
  api.ui.showNotification({
    message: `${manifest.name} plugin activated! Press Cmd/Ctrl+Shift+H to say hello.`,
    type: 'success',
    duration: 3000,
  });
};

/**
 * Plugin deactivation function.
 *
 * This is called when:
 * - The user disables the plugin
 * - The application is shutting down
 * - The plugin is being uninstalled
 *
 * Use this to clean up any resources your plugin has allocated.
 * Note: Commands, menu items, and hooks registered via the API
 * are automatically cleaned up, but it's good practice to do it
 * explicitly for clarity and to handle any custom cleanup.
 */
export const deactivate: PluginModule['deactivate'] = () => {
  // Call all stored cleanup functions
  for (const dispose of disposables) {
    dispose();
  }

  // Clear the disposables array
  disposables.length = 0;
};
