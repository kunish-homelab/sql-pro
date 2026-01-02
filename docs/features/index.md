# Features Overview

SQL Pro is a professional SQLite database manager packed with powerful features designed for developers, data analysts, and database administrators. This guide provides an overview of all major features and links to detailed documentation for each.

::: info Quick Navigation
Jump to: [Query Editor](#query-editor) • [Schema Browser](#schema-browser) • [Data Editing](#data-editing) • [ER Diagram](#er-diagram) • [Query History](#query-history) • [SQLCipher](#sqlcipher)
:::

## Core Features

SQL Pro combines essential database management tools with advanced features that set it apart from other SQLite tools.

### Query Editor

The heart of SQL Pro's functionality. Write, execute, and optimize SQL queries with a professional-grade editor built on Monaco (the same engine that powers VS Code).

| Capability                   | Description                                                     |
| ---------------------------- | --------------------------------------------------------------- |
| **Intelligent Autocomplete** | Context-aware suggestions for tables, columns, and SQL keywords |
| **Syntax Highlighting**      | Color-coded SQL for improved readability                        |
| **Vim Mode**                 | Full Vim keybindings for power users                            |
| **Query Formatting**         | Automatic SQL formatting with one keystroke                     |
| **Multi-Tab Editing**        | Work with multiple queries simultaneously                       |

::: tip Keyboard Shortcut
Execute queries instantly with <kbd>Cmd/Ctrl</kbd> + <kbd>Enter</kbd>
:::

[**Learn more about the Query Editor →**](./query-editor)

---

### Schema Browser

Navigate your database structure with an intuitive sidebar that displays all tables, views, and triggers with their metadata.

| Capability            | Description                                       |
| --------------------- | ------------------------------------------------- |
| **Schema Tree**       | Hierarchical view of all database objects         |
| **Quick Search**      | Filter tables and views instantly                 |
| **Row Counts**        | See record counts at a glance                     |
| **Schema Details**    | View columns, indexes, foreign keys, and triggers |
| **CREATE Statements** | Access original table definitions                 |

::: info Visual Navigation
The schema browser includes Vim keybindings for keyboard-first navigation.
:::

[**Learn more about the Schema Browser →**](./schema-browser)

---

### Data Editing

Edit data directly in the table view with a visual diff preview before committing changes. This unique approach prevents accidental data modifications.

| Capability           | Description                                         |
| -------------------- | --------------------------------------------------- |
| **Inline Editing**   | Edit cells directly in the data grid                |
| **Diff Preview**     | Review all changes before applying                  |
| **Batch Operations** | Insert, update, or delete multiple rows             |
| **Undo Support**     | Cancel pending changes before commit                |
| **Column Sorting**   | Sort by any column in ascending or descending order |

::: warning Safe Editing
All changes are staged until you explicitly apply them. This prevents accidental data loss.
:::

[**Learn more about Data Editing →**](./data-editing)

---

### ER Diagram

Visualize your database structure with an interactive entity-relationship diagram. Understand table relationships at a glance.

| Capability                     | Description                                |
| ------------------------------ | ------------------------------------------ |
| **Relationship Visualization** | See foreign key connections between tables |
| **Drag-and-Drop Layout**       | Position tables for optimal viewing        |
| **Zoom and Pan**               | Navigate large schemas easily              |
| **Auto Layout**                | Automatically arrange tables               |
| **Export**                     | Save diagrams as images                    |

::: tip Quick Access
Toggle the ER Diagram view with <kbd>Cmd/Ctrl</kbd> + <kbd>3</kbd>
:::

[**Learn more about ER Diagrams →**](./er-diagram)

---

### Query History

Never lose a query again. SQL Pro maintains a complete, searchable history of all executed queries for each database.

| Capability             | Description                       |
| ---------------------- | --------------------------------- |
| **Persistent History** | Saved to disk across sessions     |
| **Search**             | Find queries by content           |
| **Status Indicators**  | See success/failure at a glance   |
| **Execution Time**     | Track query performance           |
| **Click to Reuse**     | Load any previous query instantly |

[**Learn more about Query History →**](./query-history)

---

### SQLCipher Support

Work with encrypted SQLite databases using industry-standard SQLCipher encryption. SQL Pro handles password management securely.

| Capability                  | Description                                 |
| --------------------------- | ------------------------------------------- |
| **Auto-Detection**          | Automatically detects encrypted databases   |
| **Multiple Cipher Formats** | Supports various SQLCipher versions         |
| **Secure Password Storage** | Uses system keychain for credential storage |
| **Remember Password**       | Optionally save passwords for quick access  |
| **Session Management**      | Clear saved passwords when needed           |

::: tip Security First
Passwords are stored using your operating system's secure keychain (Keychain on macOS, Credential Manager on Windows, libsecret on Linux).
:::

[**Learn more about SQLCipher Support →**](./sqlcipher)

---

## Feature Comparison

See how SQL Pro compares to other database tools:

| Feature               | SQL Pro            | Typical Tools       |
| --------------------- | ------------------ | ------------------- |
| **SQLite Support**    | ✅ Full            | ✅ Full             |
| **SQLCipher Support** | ✅ Built-in        | ❌ Requires plugins |
| **Diff Preview**      | ✅ Visual          | ❌ Direct edits     |
| **Query History**     | ✅ Searchable      | ⚠️ Limited          |
| **ER Diagrams**       | ✅ Interactive     | ⚠️ Static           |
| **Vim Mode**          | ✅ Full support    | ❌ None             |
| **Cross-Platform**    | ✅ macOS/Win/Linux | ⚠️ Varies           |
| **Open Source**       | ✅ MIT License     | ❌ Proprietary      |

## Quick Start by Use Case

### For Data Analysis

1. [Open your database](/getting-started/first-connection)
2. [Browse the schema](/features/schema-browser) to understand the data structure
3. [Write queries](/features/query-editor) to extract insights
4. Export results for further analysis

### For Database Development

1. [Create your database](/getting-started/first-connection)
2. [Define tables](/features/query-editor) using CREATE statements
3. [Visualize relationships](/features/er-diagram) with ER diagrams
4. [Edit test data](/features/data-editing) directly in the grid

### For Secure Data Management

1. [Connect to encrypted database](/features/sqlcipher)
2. [Review data](/features/schema-browser) with secure access
3. [Make changes](/features/data-editing) with diff preview
4. Password securely stored in system keychain

## Keyboard-First Design

SQL Pro is designed for power users who prefer keyboard navigation. Every major feature is accessible via keyboard shortcuts.

| Action              | Shortcut                               |
| ------------------- | -------------------------------------- |
| Execute Query       | <kbd>Cmd/Ctrl</kbd> + <kbd>Enter</kbd> |
| Apply Changes       | <kbd>Cmd/Ctrl</kbd> + <kbd>S</kbd>     |
| Toggle ER Diagram   | <kbd>Cmd/Ctrl</kbd> + <kbd>3</kbd>     |
| Toggle Schema Panel | <kbd>Cmd/Ctrl</kbd> + <kbd>4</kbd>     |
| Open Settings       | <kbd>Cmd/Ctrl</kbd> + <kbd>,</kbd>     |

[**See all keyboard shortcuts →**](/shortcuts)

## Next Steps

Ready to dive deeper into SQL Pro?

### Learn More
- 📚 [Getting Started Guide](/getting-started/) - New user setup and first connection
- ⌨️ [Keyboard Shortcuts](/shortcuts) - Master keyboard navigation for faster workflows
- 🔌 [Plugin Development](/plugin-development) - Extend SQL Pro with custom plugins
- 🛠️ [Troubleshooting](/troubleshooting) - Solutions for common issues

### Get Involved
- 💬 [GitHub Discussions](https://github.com/kunish-homelab/sql-pro/discussions) - Ask questions and share ideas
- 🐛 [Report an Issue](https://github.com/kunish-homelab/sql-pro/issues) - Found a bug? Let us know
- 🤝 [Contributing Guide](https://github.com/kunish-homelab/sql-pro/blob/main/CONTRIBUTING.md) - Help improve SQL Pro

### Stay Updated
- ⭐ [Star on GitHub](https://github.com/kunish-homelab/sql-pro) - Show your support
- 📦 [Latest Releases](https://github.com/kunish-homelab/sql-pro/releases) - Download the newest version
- 📝 [Changelog](https://github.com/kunish-homelab/sql-pro/blob/main/CHANGELOG.md) - See what's new
