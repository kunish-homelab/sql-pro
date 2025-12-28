# SQL Pro

<p align="center">
  <img src="resources/icon.svg" width="128" height="128" alt="SQL Pro Logo">
</p>

<p align="center">
  <strong>Professional SQLite database manager with SQLCipher support and diff preview</strong>
</p>

<p align="center">
  <a href="https://github.com/kunish-homelab/sql-pro/releases"><img src="https://img.shields.io/github/v/release/kunish-homelab/sql-pro" alt="Release"></a>
  <a href="https://github.com/kunish-homelab/sql-pro/blob/main/LICENSE"><img src="https://img.shields.io/github/license/kunish-homelab/sql-pro" alt="License"></a>
  <a href="https://github.com/kunish-homelab/sql-pro/actions"><img src="https://img.shields.io/github/actions/workflow/status/kunish-homelab/sql-pro/release.yml" alt="Build Status"></a>
</p>

## ✨ Features

- 🗄️ **SQLite & SQLCipher Support** - Open and manage both regular SQLite and encrypted SQLCipher databases
- 📝 **SQL Editor** - Monaco-based editor with syntax highlighting and intelligent autocomplete
- 🔍 **Schema Browser** - Browse tables, views, and indexes with ease
- ✏️ **Inline Editing** - Edit data directly in the table view
- 📊 **Diff Preview** - Review changes before applying them to the database
- 🎨 **Dark/Light Theme** - Automatic theme switching based on system preferences
- 🔐 **Secure Password Storage** - Store database passwords securely using system keychain
- 🎯 **ER Diagram** - Interactive entity-relationship diagram with drag-and-drop
- 📜 **Query History** - Persistent query history with search and rerun capabilities
- 🔎 **Advanced Filtering** - Powerful client-side filtering and search across data

## 📸 Screenshots

![Welcome Screen](screenshots/welcome-dark.png)
![Database View](screenshots/database-dark.png)
![Table View](screenshots/table-dark.png)
![Query Editor](screenshots/query-dark.png)

## 📦 Installation

### Download

Download the latest release for your platform from the [Releases](https://github.com/kunish-homelab/sql-pro/releases) page.

| Platform              | Download                      |
| --------------------- | ----------------------------- |
| macOS (Apple Silicon) | `sql-pro-x.x.x-arm64.dmg`     |
| macOS (Intel)         | `sql-pro-x.x.x-x64.dmg`       |
| Windows               | `sql-pro-x.x.x-setup-x64.exe` |
| Linux (AppImage)      | `sql-pro-x.x.x-x64.AppImage`  |
| Linux (deb)           | `sql-pro-x.x.x-x64.deb`       |

### Build from Source

```bash
# Clone the repository
git clone https://github.com/kunish-homelab/sql-pro.git
cd sql-pro

# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Build for production
pnpm build:mac    # macOS
pnpm build:win    # Windows
pnpm build:linux  # Linux
```

## 🚀 Usage

1. **Open a Database** - Click "Open Database" to select a SQLite/SQLCipher database file
2. **Browse Schema** - Use the sidebar to navigate tables, views, and indexes
3. **Query Data** - Use the SQL editor to write and execute queries
4. **Edit Data** - Double-click cells to edit values directly
5. **Review Changes** - Click "Apply Changes" to preview and commit your modifications

## ⌨️ Keyboard Shortcuts

| Shortcut           | Action                          |
| ------------------ | ------------------------------- |
| `Cmd/Ctrl + Enter` | Execute SQL query               |
| `Cmd/Ctrl + S`     | Apply changes                   |
| `Escape`           | Cancel editing                  |
| `Tab`              | Navigate to next cell           |
| `Enter`            | Confirm edit / Move to next row |
| `Delete`           | Delete selected row             |

## 🛠️ Development

### Prerequisites

- Node.js 20+
- pnpm 10+
- For icon generation: ImageMagick and librsvg

### Scripts

```bash
pnpm dev          # Start development server
pnpm dev:mock     # Start with mock data (for screenshots/demos)
pnpm build        # Build for production
pnpm lint         # Run ESLint
pnpm typecheck    # Run TypeScript type checking
pnpm format       # Format code with Prettier
pnpm test         # Run tests in watch mode
pnpm test:run     # Run tests once (CI mode)
pnpm test:coverage # Run tests with coverage report
pnpm test:ui      # Open Vitest UI for interactive testing
pnpm build:icons  # Generate app icons from SVG
pnpm screenshots  # Capture screenshots for documentation
```

### Testing

The project uses [Vitest](https://vitest.dev/) for unit testing with comprehensive coverage of core functionality.

#### Running Tests

```bash
# Run tests in watch mode (recommended during development)
pnpm test

# Run tests once (for CI or quick verification)
pnpm test:run

# Run tests with coverage report
pnpm test:coverage

# Open interactive Vitest UI
pnpm test:ui
```

#### Test Coverage

Tests cover the following areas with 80%+ coverage targets:

| Area             | Files                                 | Coverage           |
| ---------------- | ------------------------------------- | ------------------ |
| Utilities        | `lib/utils.ts`, `lib/filter-utils.ts` | 99%+               |
| SQL Logic        | `lib/monaco-sql-config.ts`            | Comprehensive      |
| State Management | `stores/*.ts`                         | All actions tested |

#### Test Structure

```
src/renderer/src/
├── lib/
│   ├── utils.test.ts           # Utility function tests
│   ├── filter-utils.test.ts    # Filter logic tests
│   └── monaco-sql-config.test.ts # SQL parsing/formatting tests
└── stores/
    ├── theme-store.test.ts     # Theme store tests
    ├── connection-store.test.ts # Connection store tests
    ├── query-store.test.ts     # Query store tests
    └── settings-store.test.ts  # Settings store tests
```

#### Continuous Integration

Tests run automatically on every pull request via GitHub Actions. The CI pipeline includes:

- ESLint linting
- TypeScript type checking
- Unit tests with coverage reporting

### Screenshot Capture

Automated screenshot tool for documentation:

```bash
# Capture all screenshots (dark mode by default)
pnpm screenshots

# Capture specific page only
pnpm screenshots --page=welcome
pnpm screenshots --page=database
pnpm screenshots --page=table
pnpm screenshots --page=query

# Capture light mode or both themes
pnpm screenshots --light
pnpm screenshots --all

# List available pages
pnpm screenshots --list
```

Screenshots are saved to `screenshots/` directory with naming convention `{page}-{theme}.png`.

### Mock Mode

For taking screenshots or demos without a real database, you can run the app in mock mode:

```bash
pnpm dev:mock
```

Or add `?mock=true` to the URL in development mode. Mock mode provides:

- Sample database with users, products, orders, and categories tables
- Pre-populated data for UI demonstration
- All API calls return realistic mock responses

### Project Structure

```
sql-pro/
├── src/
│   ├── main/           # Electron main process
│   │   └── services/   # Database, IPC handlers
│   ├── preload/        # Preload scripts
│   └── renderer/       # React frontend
│       ├── components/ # UI components
│       ├── stores/     # Zustand stores
│       └── routes/     # TanStack Router routes
├── resources/          # App icons and assets
└── electron-builder.yml
```

## 🗺️ Roadmap

See our [detailed roadmap](docs/ROADMAP.md) for planned features and development timeline.

**Current Focus (Q1 2025):**

- Enhanced query experience with optimizer
- Multi-tab query editor
- Plugin system and extension API
- Advanced data import/export

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Check our [roadmap](docs/ROADMAP.md) for feature priorities and development plans.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Electron](https://www.electronjs.org/) - Cross-platform desktop apps
- [React](https://react.dev/) - UI library
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - Code editor
- [TanStack Table](https://tanstack.com/table) - Headless table library
- [better-sqlite3-multiple-ciphers](https://github.com/nicofuenzalida/better-sqlite3-multiple-ciphers) - SQLite with encryption support
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
