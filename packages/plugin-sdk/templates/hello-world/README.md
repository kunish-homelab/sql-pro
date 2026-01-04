# Hello World Plugin

A minimal example plugin for SQL Pro that demonstrates the basic structure and patterns for plugin development.

## What This Plugin Does

This plugin demonstrates the fundamental building blocks of a SQL Pro plugin:

1. **Command Registration** - Adds a "Hello World: Say Hello" command to the command palette
2. **Menu Items** - Adds a "Plugins > Hello World" submenu with menu items
3. **Notifications** - Shows toast notifications to the user
4. **Plugin Lifecycle** - Implements both `activate` and `deactivate` functions

## Quick Start

### Using This Template

1. Copy this entire `hello-world` directory to start a new plugin
2. Update `plugin.json` with your plugin's information:
   - Change `id` to a unique identifier (e.g., `com.yourname.myplugin`)
   - Update `name`, `description`, and `author`
   - Adjust `permissions` based on what APIs you'll use
3. Modify `index.ts` to implement your plugin's functionality
4. Compile TypeScript to JavaScript:
   ```bash
   npx tsgo index.ts --outDir dist --declaration
   ```
5. Update `main` in `plugin.json` to point to your compiled entry file

### Installing the Plugin

1. Package your plugin as a `.sqlpro-plugin` file (ZIP archive):
   ```bash
   zip -r hello-world.sqlpro-plugin plugin.json index.js
   ```
2. Open SQL Pro and go to **Plugins** (Cmd/Ctrl+Shift+P)
3. Click **Browse Marketplace** or drag-and-drop the plugin file
4. Enable the plugin

## File Structure

```
hello-world/
├── plugin.json     # Plugin manifest (required)
├── index.ts        # Plugin entry point (TypeScript source)
├── index.js        # Compiled JavaScript (for distribution)
└── README.md       # This file
```

## Plugin Manifest (`plugin.json`)

The manifest file defines your plugin's metadata and requirements:

```json
{
  "id": "com.sqlpro.example.hello-world",
  "name": "Hello World",
  "version": "1.0.0",
  "description": "A minimal example plugin...",
  "author": "SQL Pro Team",
  "main": "index.js",
  "permissions": ["ui:command", "ui:menu"],
  "engines": {
    "sqlpro": "^1.6.0"
  }
}
```

### Required Fields

| Field         | Description                                         |
| ------------- | --------------------------------------------------- |
| `id`          | Unique plugin identifier in reverse domain notation |
| `name`        | Human-readable plugin name                          |
| `version`     | Semantic version (e.g., `1.0.0`)                    |
| `description` | Brief description of the plugin                     |
| `author`      | Author name or organization                         |
| `main`        | Path to the compiled JavaScript entry file          |

### Optional Fields

| Field            | Description                                     |
| ---------------- | ----------------------------------------------- |
| `permissions`    | Array of permission strings (for documentation) |
| `engines.sqlpro` | Required SQL Pro version range                  |
| `license`        | SPDX license identifier                         |
| `keywords`       | Search keywords for marketplace                 |
| `homepage`       | Plugin homepage URL                             |
| `repository`     | Source code repository URL                      |
| `icon`           | Path to plugin icon (128x128 recommended)       |
| `screenshots`    | Array of screenshot paths                       |

## Entry Point (`index.ts`)

Your plugin must export an `activate` function. The `deactivate` function is optional but recommended.

```typescript
import type { PluginContext, PluginModule } from '@sqlpro/plugin-sdk';

// Store cleanup functions
const disposables: Array<() => void> = [];

export const activate: PluginModule['activate'] = (context) => {
  const { api, manifest } = context;

  // Register a command
  const unregister = api.ui.registerCommand({
    id: `${manifest.id}.myCommand`,
    title: 'My Command',
    handler: () => {
      api.ui.showNotification({
        message: 'Command executed!',
        type: 'success',
      });
    },
  });

  disposables.push(unregister);
};

export const deactivate: PluginModule['deactivate'] = () => {
  disposables.forEach((dispose) => dispose());
  disposables.length = 0;
};
```

## Available APIs

This plugin uses the following APIs:

### UI Extension API (`api.ui`)

| Method                      | Description                               |
| --------------------------- | ----------------------------------------- |
| `registerCommand(options)`  | Register a command in the command palette |
| `registerMenuItem(options)` | Add an item to the application menu       |
| `registerPanel(options)`    | Create a custom UI panel                  |
| `showNotification(options)` | Display a toast notification              |

### Metadata API (`api.metadata`)

| Method                   | Description                     |
| ------------------------ | ------------------------------- |
| `getPluginInfo()`        | Get this plugin's manifest data |
| `getAppInfo()`           | Get SQL Pro application info    |
| `getCurrentConnection()` | Get current database connection |

## Keyboard Shortcuts

This plugin registers the following keyboard shortcut:

| Shortcut           | Action                        |
| ------------------ | ----------------------------- |
| `Cmd/Ctrl+Shift+H` | Say Hello (show notification) |

## Learn More

- [Plugin Development Guide](../../../docs/plugin-development.md)
- [Plugin API Reference](../../../docs/plugin-api.md)
- [More Example Plugins](../)

## License

MIT License - Use this template freely for your own plugins!
