---
layout: home

hero:
  name: SQL Pro
  text: Professional SQLite Database Manager
  tagline: Open-source database management with SQLCipher support, diff preview, and powerful query tools
  image:
    src: /logo.svg
    alt: SQL Pro Logo
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started/
    - theme: alt
      text: View Features
      link: /features/
    - theme: alt
      text: GitHub
      link: https://github.com/kunish-homelab/sql-pro

features:
  - icon: 🗄️
    title: SQLite & SQLCipher Support
    details: Open and manage both regular SQLite and encrypted SQLCipher databases with secure password storage using system keychain.

  - icon: 📝
    title: Powerful SQL Editor
    details: Monaco-based editor with syntax highlighting, intelligent autocomplete, and persistent query history with search capabilities.

  - icon: 🔍
    title: Schema Browser
    details: Browse tables, views, and indexes with ease. Navigate your database structure efficiently with an intuitive sidebar.

  - icon: ✏️
    title: Inline Data Editing
    details: Edit data directly in the table view with cell-level editing. Review all changes with diff preview before applying them.

  - icon: 🎯
    title: ER Diagram
    details: Interactive entity-relationship diagram with drag-and-drop positioning. Visualize table relationships at a glance.

  - icon: 🎨
    title: Beautiful Interface
    details: Automatic dark/light theme switching based on system preferences. Clean, modern design that works the way you expect.
---

## Quick Start

Get up and running with SQL Pro in minutes:

1. **Download** the [latest release](https://github.com/kunish-homelab/sql-pro/releases) for your platform
2. **Install** the application on your system
3. **Open** a SQLite or SQLCipher database file
4. **Start** browsing and querying your data

Ready to dive deeper? Check out our [Getting Started guide](/getting-started/) for detailed instructions.

## Screenshots

<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; margin-top: 2rem;">
  <div>
    <img src="/screenshots/welcome-dark.png" alt="SQL Pro Welcome Screen showing recent databases and quick actions" style="border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
    <p style="text-align: center; margin-top: 0.5rem; color: var(--vp-c-text-2);">Welcome Screen</p>
  </div>
  <div>
    <img src="/screenshots/database-dark.png" alt="SQL Pro Database View showing schema browser and data grid" style="border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
    <p style="text-align: center; margin-top: 0.5rem; color: var(--vp-c-text-2);">Database View</p>
  </div>
  <div>
    <img src="/screenshots/query-dark.png" alt="SQL Pro Query Editor with syntax highlighting and results" style="border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
    <p style="text-align: center; margin-top: 0.5rem; color: var(--vp-c-text-2);">Query Editor</p>
  </div>
  <div>
    <img src="/screenshots/table-dark.png" alt="SQL Pro Table View with inline editing capabilities" style="border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
    <p style="text-align: center; margin-top: 0.5rem; color: var(--vp-c-text-2);">Table View</p>
  </div>
</div>

## Why SQL Pro?

| Feature                 | SQL Pro                  | Other Tools          |
| ----------------------- | ------------------------ | -------------------- |
| **Open Source**         | ✅ MIT Licensed          | Often proprietary    |
| **SQLCipher Support**   | ✅ Built-in              | Requires plugins     |
| **Diff Preview**        | ✅ Review before save    | Direct modifications |
| **Cross-Platform**      | ✅ macOS, Windows, Linux | Platform-specific    |
| **Secure Storage**      | ✅ System keychain       | Plain text files     |
| **No Account Required** | ✅ Fully offline         | Cloud dependencies   |

## Keyboard-First Design

SQL Pro is designed for power users who prefer keyboard navigation:

- **`Cmd/Ctrl + Enter`** — Execute SQL query
- **`Cmd/Ctrl + S`** — Apply changes
- **`Tab`** — Navigate between cells
- **`Escape`** — Cancel current action

See the complete [Keyboard Shortcuts Reference](/shortcuts) for all available shortcuts.
