/**
 * UI Extension API
 *
 * Provides plugin API methods for extending the SQL Pro user interface:
 * - registerCommand(): Register commands in the command palette
 * - registerMenuItem(): Register items in the application menu
 * - registerPanel(): Register custom panels in the UI
 * - showNotification(): Display notifications to the user
 *
 * Following the service module pattern from database.ts and menu.ts
 */

import type {
  CommandOptions,
  MenuItemOptions,
  NotificationOptions,
  PanelOptions,
} from '../types/plugin';
import { BrowserWindow } from 'electron';
import EventEmitter from 'eventemitter3';
import { IPC_CHANNELS } from '../../shared/types';

// ============ Types ============

/**
 * Result type for UI extension operations.
 */
export type UIExtensionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string; errorCode?: UIExtensionErrorCode };

/**
 * Error codes specific to UI extension operations.
 */
export type UIExtensionErrorCode =
  | 'COMMAND_ALREADY_REGISTERED'
  | 'COMMAND_NOT_FOUND'
  | 'MENU_ITEM_ALREADY_REGISTERED'
  | 'MENU_ITEM_NOT_FOUND'
  | 'PANEL_ALREADY_REGISTERED'
  | 'PANEL_NOT_FOUND'
  | 'INVALID_OPTIONS'
  | 'HANDLER_ERROR';

/**
 * Internal representation of a registered command.
 */
interface RegisteredCommand {
  /** Plugin ID that registered this command */
  pluginId: string;
  /** Command options */
  options: CommandOptions;
  /** Handler function reference */
  handler: () => void | Promise<void>;
}

/**
 * Internal representation of a registered menu item.
 */
interface RegisteredMenuItem {
  /** Plugin ID that registered this menu item */
  pluginId: string;
  /** Menu item options */
  options: MenuItemOptions;
  /** Handler function reference */
  handler: () => void | Promise<void>;
}

/**
 * Internal representation of a registered panel.
 */
interface RegisteredPanel {
  /** Plugin ID that registered this panel */
  pluginId: string;
  /** Panel options */
  options: PanelOptions;
  /** Whether the panel is currently visible */
  isVisible: boolean;
}

// ============ Event Types ============

/**
 * Event types emitted by UIExtensionService.
 */
export type UIExtensionEventType =
  | 'command:registered'
  | 'command:unregistered'
  | 'command:executed'
  | 'menuItem:registered'
  | 'menuItem:unregistered'
  | 'menuItem:clicked'
  | 'panel:registered'
  | 'panel:unregistered'
  | 'panel:shown'
  | 'panel:hidden'
  | 'notification:shown'
  | 'menu:updated';

/**
 * Event payload types.
 */
export interface UIExtensionEvents {
  'command:registered': {
    pluginId: string;
    commandId: string;
    command: CommandOptions;
  };
  'command:unregistered': { pluginId: string; commandId: string };
  'command:executed': { pluginId: string; commandId: string };
  'menuItem:registered': {
    pluginId: string;
    menuItemId: string;
    menuItem: MenuItemOptions;
  };
  'menuItem:unregistered': { pluginId: string; menuItemId: string };
  'menuItem:clicked': { pluginId: string; menuItemId: string };
  'panel:registered': {
    pluginId: string;
    panelId: string;
    panel: PanelOptions;
  };
  'panel:unregistered': { pluginId: string; panelId: string };
  'panel:shown': { pluginId: string; panelId: string };
  'panel:hidden': { pluginId: string; panelId: string };
  'notification:shown': NotificationOptions;
  'menu:updated': void;
}

// ============ UIExtensionService Class ============

/**
 * UIExtensionService
 *
 * Central service for managing plugin UI extensions.
 * Follows the singleton service pattern from database.ts.
 *
 * Key features:
 * - Command registration for command palette integration
 * - Dynamic menu item registration
 * - Panel registration for custom UI views
 * - Notification system for user feedback
 * - Automatic cleanup when plugins are unloaded
 *
 * @example
 * ```typescript
 * // Register a command from a plugin
 * uiExtensionService.registerCommand('my-plugin', {
 *   id: 'my-command',
 *   title: 'My Custom Command',
 *   category: 'Plugins',
 *   handler: () => console.log('Command executed!')
 * });
 *
 * // Register a menu item
 * uiExtensionService.registerMenuItem('my-plugin', {
 *   id: 'my-menu-item',
 *   label: 'My Menu Action',
 *   menuPath: 'Plugins/My Plugin',
 *   handler: () => console.log('Menu clicked!')
 * });
 * ```
 */
class UIExtensionService extends EventEmitter {
  /**
   * Map of registered commands.
   * Key is the command ID.
   */
  private commands: Map<string, RegisteredCommand> = new Map();

  /**
   * Map of registered menu items.
   * Key is the menu item ID.
   */
  private menuItems: Map<string, RegisteredMenuItem> = new Map();

  /**
   * Map of registered panels.
   * Key is the panel ID.
   */
  private panels: Map<string, RegisteredPanel> = new Map();

  /**
   * Flag to track if menu rebuild is pending.
   * Used to batch menu updates.
   */
  private menuRebuildPending = false;

  /**
   * Debounce timer for menu rebuilds.
   */
  private menuRebuildTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
  }

  // ============ Command API ============

  /**
   * Register a command for the command palette.
   *
   * @param pluginId - The ID of the plugin registering the command
   * @param options - Command configuration options
   * @returns Result with unregister function or error
   *
   * @example
   * ```typescript
   * const result = uiExtensionService.registerCommand('my-plugin', {
   *   id: 'format-sql',
   *   title: 'Format SQL Query',
   *   category: 'SQL',
   *   shortcut: 'CmdOrCtrl+Shift+F',
   *   handler: async () => {
   *     // Format the current query
   *   }
   * });
   *
   * if (result.success) {
   *   // Store the unregister function for cleanup
   *   const unregister = result.data;
   * }
   * ```
   */
  registerCommand(
    pluginId: string,
    options: CommandOptions
  ): UIExtensionResult<() => void> {
    // Validate options
    if (!options.id || typeof options.id !== 'string') {
      return {
        success: false,
        error: 'Command ID is required and must be a string',
        errorCode: 'INVALID_OPTIONS',
      };
    }

    if (!options.title || typeof options.title !== 'string') {
      return {
        success: false,
        error: 'Command title is required and must be a string',
        errorCode: 'INVALID_OPTIONS',
      };
    }

    if (!options.handler || typeof options.handler !== 'function') {
      return {
        success: false,
        error: 'Command handler is required and must be a function',
        errorCode: 'INVALID_OPTIONS',
      };
    }

    // Create fully qualified command ID
    const commandId = this.getFullCommandId(pluginId, options.id);

    // Check for duplicate
    if (this.commands.has(commandId)) {
      return {
        success: false,
        error: `Command already registered: ${commandId}`,
        errorCode: 'COMMAND_ALREADY_REGISTERED',
      };
    }

    // Register the command
    const registeredCommand: RegisteredCommand = {
      pluginId,
      options: { ...options, id: commandId },
      handler: options.handler,
    };

    this.commands.set(commandId, registeredCommand);

    // Emit event
    this.emit('command:registered', {
      pluginId,
      commandId,
      command: registeredCommand.options,
    });

    // Notify renderer about new command
    this.notifyCommandsChanged();

    // Return unregister function
    const unregister = () => {
      this.unregisterCommand(pluginId, options.id);
    };

    return { success: true, data: unregister };
  }

  /**
   * Unregister a command.
   *
   * @param pluginId - The plugin ID that registered the command
   * @param commandId - The command ID to unregister
   * @returns Success or error result
   */
  unregisterCommand(pluginId: string, commandId: string): UIExtensionResult {
    const fullCommandId = this.getFullCommandId(pluginId, commandId);
    const command = this.commands.get(fullCommandId);

    if (!command) {
      return {
        success: false,
        error: `Command not found: ${fullCommandId}`,
        errorCode: 'COMMAND_NOT_FOUND',
      };
    }

    // Verify ownership
    if (command.pluginId !== pluginId) {
      return {
        success: false,
        error: 'Cannot unregister command owned by another plugin',
        errorCode: 'COMMAND_NOT_FOUND',
      };
    }

    this.commands.delete(fullCommandId);

    // Emit event
    this.emit('command:unregistered', {
      pluginId,
      commandId: fullCommandId,
    });

    // Notify renderer
    this.notifyCommandsChanged();

    return { success: true };
  }

  /**
   * Execute a registered command.
   *
   * @param commandId - The full command ID to execute
   * @returns Success or error result
   */
  async executeCommand(commandId: string): Promise<UIExtensionResult> {
    const command = this.commands.get(commandId);

    if (!command) {
      return {
        success: false,
        error: `Command not found: ${commandId}`,
        errorCode: 'COMMAND_NOT_FOUND',
      };
    }

    try {
      await Promise.resolve(command.handler());

      // Emit event
      this.emit('command:executed', {
        pluginId: command.pluginId,
        commandId,
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Command execution failed: ${error instanceof Error ? error.message : String(error)}`,
        errorCode: 'HANDLER_ERROR',
      };
    }
  }

  /**
   * Get all registered commands.
   *
   * @param pluginId - Optional filter by plugin ID
   * @returns Array of registered commands
   */
  getCommands(pluginId?: string): CommandOptions[] {
    const commands = Array.from(this.commands.values());

    if (pluginId) {
      return commands
        .filter((cmd) => cmd.pluginId === pluginId)
        .map((cmd) => cmd.options);
    }

    return commands.map((cmd) => cmd.options);
  }

  // ============ Menu Item API ============

  /**
   * Register a menu item in the application menu.
   *
   * @param pluginId - The ID of the plugin registering the menu item
   * @param options - Menu item configuration options
   * @returns Result with unregister function or error
   *
   * @example
   * ```typescript
   * const result = uiExtensionService.registerMenuItem('my-plugin', {
   *   id: 'export-csv',
   *   label: 'Export to CSV',
   *   menuPath: 'Plugins/Export',
   *   shortcut: 'CmdOrCtrl+E',
   *   handler: async () => {
   *     // Export data to CSV
   *   }
   * });
   * ```
   */
  registerMenuItem(
    pluginId: string,
    options: MenuItemOptions
  ): UIExtensionResult<() => void> {
    // Validate options
    if (!options.id || typeof options.id !== 'string') {
      return {
        success: false,
        error: 'Menu item ID is required and must be a string',
        errorCode: 'INVALID_OPTIONS',
      };
    }

    if (!options.label || typeof options.label !== 'string') {
      return {
        success: false,
        error: 'Menu item label is required and must be a string',
        errorCode: 'INVALID_OPTIONS',
      };
    }

    if (!options.menuPath || typeof options.menuPath !== 'string') {
      return {
        success: false,
        error: 'Menu path is required and must be a string',
        errorCode: 'INVALID_OPTIONS',
      };
    }

    if (!options.handler || typeof options.handler !== 'function') {
      return {
        success: false,
        error: 'Menu item handler is required and must be a function',
        errorCode: 'INVALID_OPTIONS',
      };
    }

    // Create fully qualified menu item ID
    const menuItemId = this.getFullMenuItemId(pluginId, options.id);

    // Check for duplicate
    if (this.menuItems.has(menuItemId)) {
      return {
        success: false,
        error: `Menu item already registered: ${menuItemId}`,
        errorCode: 'MENU_ITEM_ALREADY_REGISTERED',
      };
    }

    // Register the menu item
    const registeredMenuItem: RegisteredMenuItem = {
      pluginId,
      options: { ...options, id: menuItemId },
      handler: options.handler,
    };

    this.menuItems.set(menuItemId, registeredMenuItem);

    // Emit event
    this.emit('menuItem:registered', {
      pluginId,
      menuItemId,
      menuItem: registeredMenuItem.options,
    });

    // Schedule menu rebuild
    this.scheduleMenuRebuild();

    // Return unregister function
    const unregister = () => {
      this.unregisterMenuItem(pluginId, options.id);
    };

    return { success: true, data: unregister };
  }

  /**
   * Unregister a menu item.
   *
   * @param pluginId - The plugin ID that registered the menu item
   * @param menuItemId - The menu item ID to unregister
   * @returns Success or error result
   */
  unregisterMenuItem(pluginId: string, menuItemId: string): UIExtensionResult {
    const fullMenuItemId = this.getFullMenuItemId(pluginId, menuItemId);
    const menuItem = this.menuItems.get(fullMenuItemId);

    if (!menuItem) {
      return {
        success: false,
        error: `Menu item not found: ${fullMenuItemId}`,
        errorCode: 'MENU_ITEM_NOT_FOUND',
      };
    }

    // Verify ownership
    if (menuItem.pluginId !== pluginId) {
      return {
        success: false,
        error: 'Cannot unregister menu item owned by another plugin',
        errorCode: 'MENU_ITEM_NOT_FOUND',
      };
    }

    this.menuItems.delete(fullMenuItemId);

    // Emit event
    this.emit('menuItem:unregistered', {
      pluginId,
      menuItemId: fullMenuItemId,
    });

    // Schedule menu rebuild
    this.scheduleMenuRebuild();

    return { success: true };
  }

  /**
   * Get all registered menu items.
   *
   * @param pluginId - Optional filter by plugin ID
   * @returns Array of registered menu items
   */
  getMenuItems(pluginId?: string): MenuItemOptions[] {
    const menuItems = Array.from(this.menuItems.values());

    if (pluginId) {
      return menuItems
        .filter((item) => item.pluginId === pluginId)
        .map((item) => item.options);
    }

    return menuItems.map((item) => item.options);
  }

  /**
   * Get menu items grouped by menu path.
   * Useful for building dynamic menus.
   *
   * @returns Map of menu path to menu items
   */
  getMenuItemsByPath(): Map<string, MenuItemOptions[]> {
    const byPath = new Map<string, MenuItemOptions[]>();

    for (const menuItem of this.menuItems.values()) {
      const path = menuItem.options.menuPath;
      const items = byPath.get(path) || [];
      items.push(menuItem.options);
      byPath.set(path, items);
    }

    return byPath;
  }

  /**
   * Build Electron menu item constructors from registered menu items.
   * This is used by the menu service to integrate plugin menu items.
   *
   * @returns Array of Electron menu item constructor options
   */
  buildPluginMenuItems(): Electron.MenuItemConstructorOptions[] {
    const menuItemsByPath = this.getMenuItemsByPath();
    const pluginMenuItems: Electron.MenuItemConstructorOptions[] = [];

    // Group by top-level menu path
    const topLevelMenus = new Map<
      string,
      Electron.MenuItemConstructorOptions[]
    >();

    for (const [path, items] of menuItemsByPath.entries()) {
      const pathParts = path.split('/');
      const topLevel = pathParts[0];
      const subPath = pathParts.slice(1).join('/');

      const menuGroup = topLevelMenus.get(topLevel) || [];

      for (const item of items) {
        const menuItemConstructor: Electron.MenuItemConstructorOptions = {
          label: item.label,
          accelerator: item.shortcut,
          click: () => this.handleMenuItemClick(item.id),
          enabled: item.isEnabled ? item.isEnabled() : true,
          visible: item.isVisible ? item.isVisible() : true,
        };

        if (subPath) {
          // Create nested submenu structure
          let currentLevel = menuGroup;
          const subParts = subPath.split('/');

          for (let i = 0; i < subParts.length; i++) {
            const subMenuLabel = subParts[i];
            let subMenu = currentLevel.find((m) => m.label === subMenuLabel);

            if (!subMenu) {
              subMenu = {
                label: subMenuLabel,
                submenu: [],
              };
              currentLevel.push(subMenu);
            }

            if (i === subParts.length - 1) {
              // Add the item to this level
              (subMenu.submenu as Electron.MenuItemConstructorOptions[]).push(
                menuItemConstructor
              );
            } else {
              currentLevel =
                subMenu.submenu as Electron.MenuItemConstructorOptions[];
            }
          }
        } else {
          menuGroup.push(menuItemConstructor);
        }
      }

      topLevelMenus.set(topLevel, menuGroup);
    }

    // Build the Plugins menu if there are any items
    if (topLevelMenus.size > 0) {
      const pluginsMenu: Electron.MenuItemConstructorOptions = {
        label: 'Plugins',
        submenu: [],
      };

      for (const [topLevel, items] of topLevelMenus.entries()) {
        if (topLevel === 'Plugins') {
          // Add directly to Plugins menu
          (pluginsMenu.submenu as Electron.MenuItemConstructorOptions[]).push(
            ...items
          );
        } else {
          // Add as submenu
          (pluginsMenu.submenu as Electron.MenuItemConstructorOptions[]).push({
            label: topLevel,
            submenu: items,
          });
        }
      }

      if (
        (pluginsMenu.submenu as Electron.MenuItemConstructorOptions[]).length >
        0
      ) {
        pluginMenuItems.push(pluginsMenu);
      }
    }

    return pluginMenuItems;
  }

  /**
   * Handle menu item click and invoke the handler.
   */
  private async handleMenuItemClick(menuItemId: string): Promise<void> {
    const menuItem = this.menuItems.get(menuItemId);

    if (!menuItem) {
      return;
    }

    try {
      await Promise.resolve(menuItem.handler());

      // Emit event
      this.emit('menuItem:clicked', {
        pluginId: menuItem.pluginId,
        menuItemId,
      });
    } catch (error) {
      // Emit error event
      this.emit('error', {
        type: 'menuItem:handler',
        pluginId: menuItem.pluginId,
        menuItemId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // ============ Panel API ============

  /**
   * Register a panel in the UI.
   *
   * @param pluginId - The ID of the plugin registering the panel
   * @param options - Panel configuration options
   * @returns Result with unregister function or error
   *
   * @example
   * ```typescript
   * const result = uiExtensionService.registerPanel('my-plugin', {
   *   id: 'query-stats',
   *   title: 'Query Statistics',
   *   location: 'sidebar',
   *   icon: 'chart',
   *   render: () => '<div>Stats content here</div>'
   * });
   * ```
   */
  registerPanel(
    pluginId: string,
    options: PanelOptions
  ): UIExtensionResult<() => void> {
    // Validate options
    if (!options.id || typeof options.id !== 'string') {
      return {
        success: false,
        error: 'Panel ID is required and must be a string',
        errorCode: 'INVALID_OPTIONS',
      };
    }

    if (!options.title || typeof options.title !== 'string') {
      return {
        success: false,
        error: 'Panel title is required and must be a string',
        errorCode: 'INVALID_OPTIONS',
      };
    }

    const validLocations = ['sidebar', 'bottom', 'right'];
    if (!options.location || !validLocations.includes(options.location)) {
      return {
        success: false,
        error: `Panel location must be one of: ${validLocations.join(', ')}`,
        errorCode: 'INVALID_OPTIONS',
      };
    }

    if (!options.render || typeof options.render !== 'function') {
      return {
        success: false,
        error: 'Panel render function is required',
        errorCode: 'INVALID_OPTIONS',
      };
    }

    // Create fully qualified panel ID
    const panelId = this.getFullPanelId(pluginId, options.id);

    // Check for duplicate
    if (this.panels.has(panelId)) {
      return {
        success: false,
        error: `Panel already registered: ${panelId}`,
        errorCode: 'PANEL_ALREADY_REGISTERED',
      };
    }

    // Register the panel
    const registeredPanel: RegisteredPanel = {
      pluginId,
      options: { ...options, id: panelId },
      isVisible: false,
    };

    this.panels.set(panelId, registeredPanel);

    // Emit event
    this.emit('panel:registered', {
      pluginId,
      panelId,
      panel: registeredPanel.options,
    });

    // Notify renderer about new panel
    this.notifyPanelsChanged();

    // Return unregister function
    const unregister = () => {
      this.unregisterPanel(pluginId, options.id);
    };

    return { success: true, data: unregister };
  }

  /**
   * Unregister a panel.
   *
   * @param pluginId - The plugin ID that registered the panel
   * @param panelId - The panel ID to unregister
   * @returns Success or error result
   */
  unregisterPanel(pluginId: string, panelId: string): UIExtensionResult {
    const fullPanelId = this.getFullPanelId(pluginId, panelId);
    const panel = this.panels.get(fullPanelId);

    if (!panel) {
      return {
        success: false,
        error: `Panel not found: ${fullPanelId}`,
        errorCode: 'PANEL_NOT_FOUND',
      };
    }

    // Verify ownership
    if (panel.pluginId !== pluginId) {
      return {
        success: false,
        error: 'Cannot unregister panel owned by another plugin',
        errorCode: 'PANEL_NOT_FOUND',
      };
    }

    // Call dispose if provided
    if (panel.options.dispose) {
      try {
        panel.options.dispose();
      } catch {
        // Ignore dispose errors
      }
    }

    this.panels.delete(fullPanelId);

    // Emit event
    this.emit('panel:unregistered', {
      pluginId,
      panelId: fullPanelId,
    });

    // Notify renderer
    this.notifyPanelsChanged();

    return { success: true };
  }

  /**
   * Get all registered panels.
   *
   * @param pluginId - Optional filter by plugin ID
   * @param location - Optional filter by location
   * @returns Array of registered panels
   */
  getPanels(
    pluginId?: string,
    location?: PanelOptions['location']
  ): PanelOptions[] {
    let panels = Array.from(this.panels.values());

    if (pluginId) {
      panels = panels.filter((p) => p.pluginId === pluginId);
    }

    if (location) {
      panels = panels.filter((p) => p.options.location === location);
    }

    return panels.map((p) => p.options);
  }

  /**
   * Render a panel's content.
   *
   * @param panelId - The full panel ID
   * @returns The rendered HTML content or error
   */
  async renderPanel(panelId: string): Promise<UIExtensionResult<string>> {
    const panel = this.panels.get(panelId);

    if (!panel) {
      return {
        success: false,
        error: `Panel not found: ${panelId}`,
        errorCode: 'PANEL_NOT_FOUND',
      };
    }

    try {
      const content = await Promise.resolve(panel.options.render());
      return { success: true, data: content };
    } catch (error) {
      return {
        success: false,
        error: `Panel render failed: ${error instanceof Error ? error.message : String(error)}`,
        errorCode: 'HANDLER_ERROR',
      };
    }
  }

  /**
   * Show a panel.
   *
   * @param panelId - The full panel ID
   * @returns Success or error result
   */
  showPanel(panelId: string): UIExtensionResult {
    const panel = this.panels.get(panelId);

    if (!panel) {
      return {
        success: false,
        error: `Panel not found: ${panelId}`,
        errorCode: 'PANEL_NOT_FOUND',
      };
    }

    panel.isVisible = true;

    // Emit event
    this.emit('panel:shown', {
      pluginId: panel.pluginId,
      panelId,
    });

    // Notify renderer
    this.notifyPanelsChanged();

    return { success: true };
  }

  /**
   * Hide a panel.
   *
   * @param panelId - The full panel ID
   * @returns Success or error result
   */
  hidePanel(panelId: string): UIExtensionResult {
    const panel = this.panels.get(panelId);

    if (!panel) {
      return {
        success: false,
        error: `Panel not found: ${panelId}`,
        errorCode: 'PANEL_NOT_FOUND',
      };
    }

    panel.isVisible = false;

    // Emit event
    this.emit('panel:hidden', {
      pluginId: panel.pluginId,
      panelId,
    });

    // Notify renderer
    this.notifyPanelsChanged();

    return { success: true };
  }

  // ============ Notification API ============

  /**
   * Show a notification to the user.
   *
   * @param pluginId - The ID of the plugin showing the notification
   * @param options - Notification configuration options
   *
   * @example
   * ```typescript
   * uiExtensionService.showNotification('my-plugin', {
   *   message: 'Export completed successfully',
   *   type: 'success',
   *   duration: 3000
   * });
   * ```
   */
  showNotification(pluginId: string, options: NotificationOptions): void {
    // Validate options
    if (!options.message || typeof options.message !== 'string') {
      return;
    }

    const validTypes = ['info', 'success', 'warning', 'error'];
    if (!options.type || !validTypes.includes(options.type)) {
      options.type = 'info';
    }

    // Default duration of 5 seconds
    if (options.duration === undefined) {
      options.duration = 5000;
    }

    // Emit event
    this.emit('notification:shown', options);

    // Send to all windows
    const windows = BrowserWindow.getAllWindows();
    for (const window of windows) {
      window.webContents.send(IPC_CHANNELS.PLUGIN_EVENT, {
        type: 'notification:show',
        pluginId,
        notification: options,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ============ Plugin Cleanup ============

  /**
   * Unregister all UI extensions for a plugin.
   * Called when a plugin is disabled or uninstalled.
   *
   * @param pluginId - The plugin ID to clean up
   * @returns Count of items removed
   */
  unregisterAllForPlugin(pluginId: string): {
    commands: number;
    menuItems: number;
    panels: number;
  } {
    let commandsRemoved = 0;
    let menuItemsRemoved = 0;
    let panelsRemoved = 0;

    // Remove commands
    for (const [id, command] of this.commands.entries()) {
      if (command.pluginId === pluginId) {
        this.commands.delete(id);
        commandsRemoved++;
      }
    }

    // Remove menu items
    for (const [id, menuItem] of this.menuItems.entries()) {
      if (menuItem.pluginId === pluginId) {
        this.menuItems.delete(id);
        menuItemsRemoved++;
      }
    }

    // Remove panels
    for (const [id, panel] of this.panels.entries()) {
      if (panel.pluginId === pluginId) {
        // Call dispose if provided
        if (panel.options.dispose) {
          try {
            panel.options.dispose();
          } catch {
            // Ignore dispose errors
          }
        }
        this.panels.delete(id);
        panelsRemoved++;
      }
    }

    // Rebuild menu if needed
    if (menuItemsRemoved > 0) {
      this.scheduleMenuRebuild();
    }

    // Notify renderer if anything changed
    if (commandsRemoved > 0) {
      this.notifyCommandsChanged();
    }

    if (panelsRemoved > 0) {
      this.notifyPanelsChanged();
    }

    return {
      commands: commandsRemoved,
      menuItems: menuItemsRemoved,
      panels: panelsRemoved,
    };
  }

  // ============ Helper Methods ============

  /**
   * Get the fully qualified command ID.
   */
  private getFullCommandId(pluginId: string, commandId: string): string {
    return `${pluginId}:${commandId}`;
  }

  /**
   * Get the fully qualified menu item ID.
   */
  private getFullMenuItemId(pluginId: string, menuItemId: string): string {
    return `${pluginId}:${menuItemId}`;
  }

  /**
   * Get the fully qualified panel ID.
   */
  private getFullPanelId(pluginId: string, panelId: string): string {
    return `${pluginId}:${panelId}`;
  }

  /**
   * Schedule a menu rebuild with debouncing.
   * This batches multiple menu changes into a single rebuild.
   */
  private scheduleMenuRebuild(): void {
    if (this.menuRebuildPending) {
      return;
    }

    this.menuRebuildPending = true;

    if (this.menuRebuildTimer) {
      clearTimeout(this.menuRebuildTimer);
    }

    this.menuRebuildTimer = setTimeout(() => {
      this.menuRebuildPending = false;
      this.menuRebuildTimer = null;
      this.emit('menu:updated');
    }, 100);
  }

  /**
   * Notify renderer processes that commands have changed.
   */
  private notifyCommandsChanged(): void {
    const windows = BrowserWindow.getAllWindows();
    const commands = this.getCommands();

    for (const window of windows) {
      window.webContents.send(IPC_CHANNELS.PLUGIN_EVENT, {
        type: 'commands:changed',
        commands,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Notify renderer processes that panels have changed.
   */
  private notifyPanelsChanged(): void {
    const windows = BrowserWindow.getAllWindows();
    const panels = this.getPanels();

    for (const window of windows) {
      window.webContents.send(IPC_CHANNELS.PLUGIN_EVENT, {
        type: 'panels:changed',
        panels,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get statistics about registered UI extensions.
   */
  getStats(): {
    commandCount: number;
    menuItemCount: number;
    panelCount: number;
    pluginCount: number;
  } {
    const plugins = new Set<string>();

    for (const cmd of this.commands.values()) {
      plugins.add(cmd.pluginId);
    }

    for (const item of this.menuItems.values()) {
      plugins.add(item.pluginId);
    }

    for (const panel of this.panels.values()) {
      plugins.add(panel.pluginId);
    }

    return {
      commandCount: this.commands.size,
      menuItemCount: this.menuItems.size,
      panelCount: this.panels.size,
      pluginCount: plugins.size,
    };
  }

  /**
   * Clear all registered extensions.
   * Use with caution - mainly for testing purposes.
   */
  clear(): void {
    // Dispose all panels
    for (const panel of this.panels.values()) {
      if (panel.options.dispose) {
        try {
          panel.options.dispose();
        } catch {
          // Ignore dispose errors
        }
      }
    }

    this.commands.clear();
    this.menuItems.clear();
    this.panels.clear();

    if (this.menuRebuildTimer) {
      clearTimeout(this.menuRebuildTimer);
      this.menuRebuildTimer = null;
    }

    this.menuRebuildPending = false;
  }
}

// Export singleton instance following the service pattern
export const uiExtensionService = new UIExtensionService();

// Export class for testing purposes
export { UIExtensionService };
