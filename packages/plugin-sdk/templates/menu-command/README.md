# Menu Command Plugin

An advanced example plugin for SQL Pro that demonstrates comprehensive menu item and command palette integration.

## What This Plugin Does

This plugin demonstrates advanced patterns for extending SQL Pro's menu system and command palette:

1. **Multiple Menu Items** - Register several menu items with different configurations
2. **Hierarchical Submenus** - Create nested menu structures (Settings, Actions, Help)
3. **Dynamic Menu States** - Enable/disable menu items based on application state
4. **Keyboard Shortcuts** - Bind menu items to keyboard accelerators
5. **Command Palette** - Register categorized commands with shortcuts
6. **Persistent Settings** - Save and restore user preferences using the Storage API
7. **Toggle Patterns** - Implement on/off toggles with visual indicators

## Quick Start

### Using This Template

1. Copy this entire `menu-command` directory to start a new plugin
2. Update `plugin.json` with your plugin's information:
   - Change `id` to a unique identifier (e.g., `com.yourcompany.myplugin`)
   - Update `name`, `description`, and `author`
   - Adjust `permissions` based on what APIs you'll use
3. Modify `index.ts` to implement your plugin's menu items and commands
4. Compile TypeScript to JavaScript:
   ```bash
   npx tsgo index.ts --outDir dist --declaration
   ```
5. Update `main` in `plugin.json` to point to your compiled entry file

### Installing the Plugin

1. Package your plugin as a `.sqlpro-plugin` file (ZIP archive):
   ```bash
   zip -r menu-command.sqlpro-plugin plugin.json index.js
   ```
2. Open SQL Pro and go to **Plugins** (Cmd/Ctrl+Shift+P)
3. Click **Browse Marketplace** or drag-and-drop the plugin file
4. Enable the plugin

## File Structure

```
menu-command/
├── plugin.json     # Plugin manifest (required)
├── index.ts        # Plugin entry point (TypeScript source)
├── index.js        # Compiled JavaScript (for distribution)
└── README.md       # This file
```

## Menu Structure Created

This plugin creates the following menu hierarchy:

```
Plugins
└── Menu Command
    ├── Quick Action                    (Cmd/Ctrl+Alt+Q)
    ├── Show Connection Status          (Cmd/Ctrl+Alt+C)  [enabled when connected]
    ├── Settings
    │   ├── Query Logging (On/Off)      (Cmd/Ctrl+Alt+L)  [toggle]
    │   ├── Dark Mode Preference        [toggle]
    │   └── Reset All Settings
    ├── Actions
    │   ├── Copy Timestamp              (Cmd/Ctrl+Alt+T)
    │   ├── Generate UUID               (Cmd/Ctrl+Alt+U)
    │   └── Show App Info
    └── Help
        ├── About Menu Command Plugin
        └── View Documentation
```

## Commands Registered

The following commands are added to the command palette (Cmd/Ctrl+Shift+P):

| Command                | Category | Shortcut       | Description                |
| ---------------------- | -------- | -------------- | -------------------------- |
| Toggle Query Logging   | Logging  | Cmd/Ctrl+Alt+L | Enable/disable logging     |
| Show Connection Status | Database | Cmd/Ctrl+Alt+C | Display current connection |
| Quick Action           | Actions  | Cmd/Ctrl+Alt+Q | Execute a quick action     |

## Code Examples

### Registering a Simple Menu Item

```typescript
const unregister = api.ui.registerMenuItem({
  id: `${manifest.id}.menu.myAction`,
  label: '&My Action', // & creates keyboard accelerator
  menuPath: 'Plugins/My Plugin',
  shortcut: 'CmdOrCtrl+Shift+M',
  handler: () => {
    api.ui.showNotification({
      message: 'Action executed!',
      type: 'success',
    });
  },
});

// Store for cleanup
disposables.push(unregister);
```

### Creating a Toggle Menu Item

```typescript
let isEnabled = false;

const unregister = api.ui.registerMenuItem({
  id: `${manifest.id}.menu.toggle`,
  label: `Feature (${isEnabled ? '✓ On' : 'Off'})`,
  menuPath: 'Plugins/My Plugin/Settings',
  handler: async () => {
    isEnabled = !isEnabled;
    await api.storage.set('isEnabled', isEnabled);

    api.ui.showNotification({
      message: `Feature ${isEnabled ? 'enabled' : 'disabled'}`,
      type: 'info',
    });
  },
});
```

### Conditionally Enabled Menu Item

```typescript
const unregister = api.ui.registerMenuItem({
  id: `${manifest.id}.menu.requiresConnection`,
  label: 'Requires Database',
  menuPath: 'Plugins/My Plugin',
  handler: () => {
    const conn = api.metadata.getCurrentConnection();
    // Use connection info...
  },
  // Only enabled when database is connected
  isEnabled: () => {
    const conn = api.metadata.getCurrentConnection();
    return conn !== null;
  },
});
```

### Registering a Command with Category

```typescript
const unregister = api.ui.registerCommand({
  id: `${manifest.id}.myCommand`,
  title: 'My Plugin: Do Something',
  shortcut: 'CmdOrCtrl+Shift+D',
  category: 'My Plugin', // Groups related commands
  handler: () => {
    // Command logic...
  },
});
```

### Using Storage API for Persistence

```typescript
export const activate: PluginModule['activate'] = async (context) => {
  const { api } = context;

  // Load saved preference
  const savedValue = await api.storage.get<boolean>('myPreference');
  let myPreference = savedValue ?? false;

  // Save preference when changed
  api.ui.registerMenuItem({
    id: 'myPlugin.toggle',
    label: 'Toggle Preference',
    menuPath: 'Plugins/My Plugin',
    handler: async () => {
      myPreference = !myPreference;
      await api.storage.set('myPreference', myPreference);
    },
  });
};
```

## APIs Used

### UI Extension API (`api.ui`)

| Method                      | Description                               |
| --------------------------- | ----------------------------------------- |
| `registerCommand(options)`  | Register a command in the command palette |
| `registerMenuItem(options)` | Add an item to the application menu       |
| `showNotification(options)` | Display a toast notification              |

### Storage API (`api.storage`)

| Method               | Description                     |
| -------------------- | ------------------------------- |
| `get<T>(key)`        | Get a value from plugin storage |
| `set<T>(key, value)` | Save a value to plugin storage  |
| `clear()`            | Clear all plugin storage        |

### Metadata API (`api.metadata`)

| Method                   | Description                               |
| ------------------------ | ----------------------------------------- |
| `getPluginInfo()`        | Get this plugin's manifest data           |
| `getAppInfo()`           | Get SQL Pro application info              |
| `getCurrentConnection()` | Get current database connection (or null) |

## Keyboard Shortcuts

This plugin registers the following keyboard shortcuts:

| Shortcut         | Action                 |
| ---------------- | ---------------------- |
| `Cmd/Ctrl+Alt+Q` | Quick Action           |
| `Cmd/Ctrl+Alt+C` | Show Connection Status |
| `Cmd/Ctrl+Alt+L` | Toggle Query Logging   |
| `Cmd/Ctrl+Alt+T` | Copy Timestamp         |
| `Cmd/Ctrl+Alt+U` | Generate UUID          |

## Best Practices Demonstrated

1. **Unique IDs** - All command and menu item IDs are prefixed with the plugin ID
2. **Cleanup Pattern** - All registrations are stored in `disposables` for proper cleanup
3. **Async Activation** - The `activate` function is async to allow loading from storage
4. **State Persistence** - User preferences are saved to storage and restored on activation
5. **Error Handling** - Menu items check for conditions before executing actions
6. **Keyboard Accelerators** - Use `&` in labels for quick keyboard access
7. **Visual Feedback** - Toggle states are shown in menu item labels (✓ On / Off)

## Learn More

- [Plugin Development Guide](../../../docs/plugin-development.md)
- [Plugin API Reference](../../../docs/plugin-api.md)
- [Hello World Plugin](../hello-world/) - Simpler starting point
- [Query Hook Plugin](../query-hook/) - Query interception example

## License

MIT License - Use this template freely for your own plugins!
