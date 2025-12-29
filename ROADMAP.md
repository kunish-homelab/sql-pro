# SQL Pro Roadmap

This document outlines the planned features and improvements for SQL Pro. Our goal is to build the most capable open-source SQLite database manager with a focus on developer experience, performance, and security.

## ✨ Current Version (v1.3.0)

SQL Pro currently offers:

- 🗄️ SQLite and SQLCipher encrypted database support
- 📝 Monaco-based SQL editor with autocomplete
- 🔍 Schema browser with table/view/index navigation
- ✏️ Inline data editing with diff preview
- 🎯 Interactive ER diagram visualization
- ⌨️ Vim key navigation and command palette
- 📜 Query history with search
- 🔐 Secure password storage via OS keychain
- 🎨 Dark/light theme support

## 🎯 Q1 2025 Focus

### Query Optimizer

**Status:** 🔜 Planned

- Visual query execution plan (EXPLAIN QUERY PLAN)
- Index usage analysis and recommendations
- Query performance profiling with timing breakdown
- Slow query identification and suggestions
- Index creation wizard based on query patterns

### Multi-Tab Editor

**Status:** 🔜 Planned

- Multiple query tabs per database connection
- Tab persistence across sessions
- Drag-and-drop tab reordering
- Split view for comparing queries side-by-side
- Tab groups for organizing related queries

### Plugin System

**Status:** 💡 Research

- Plugin architecture for extending functionality
- Custom export formats (Excel, JSON, CSV with options)
- Custom visualization plugins (charts, graphs)
- Theme plugins for custom color schemes
- Database-specific plugins (PostgreSQL-like features)

### Data Import/Export

**Status:** 🔜 Planned

- CSV import with column mapping wizard
- JSON import/export with nested structure support
- SQL script generation for table data
- Clipboard operations (paste from Excel/spreadsheets)
- Batch export for multiple tables

## 🚀 Q2 2025 Plans

### Database Management

- Create new databases directly in app
- Schema migration tools (table renaming, column modifications)
- Database file optimization (VACUUM, ANALYZE)
- Database backup and restore functionality
- Attach multiple databases simultaneously

### Advanced Query Features

- Query parameter binding UI
- Saved query library with categories
- Query snippets with variables
- Result set comparison between queries
- Query version history with rollback

### Collaboration Features

- Export/import database connections
- Share query collections
- Export workspace settings
- Team configuration profiles

## 🔮 Future Considerations

These features are being considered for future releases:

| Feature                 | Description                                           | Priority |
| ----------------------- | ----------------------------------------------------- | -------- |
| PostgreSQL Support      | Connect to PostgreSQL databases in addition to SQLite | Medium   |
| MySQL Support           | Connect to MySQL/MariaDB databases                    | Medium   |
| Cloud Database Sync     | Sync databases with cloud storage                     | Low      |
| AI Query Assistant      | Natural language to SQL conversion                    | Medium   |
| Stored Procedure Editor | Create and debug SQLite triggers                      | Medium   |
| Data Masking            | Mask sensitive data for development                   | Low      |
| Audit Logging           | Track all database changes                            | Low      |

## ✅ Recently Completed

### v1.3.0 (December 2025)

- ✅ Vim key navigation support in editor and application
- ✅ Command palette for quick access to all commands (`Cmd/Ctrl+Shift+P`)

### v1.2.0 (December 2025)

- ✅ Automated GitHub releases for all platforms

### v1.1.0 (December 2025)

- ✅ Mock API mode for development and testing

### v1.0.0 (December 2025)

- ✅ SQLite and SQLCipher database support
- ✅ Monaco SQL editor with autocomplete
- ✅ Schema browser with tree navigation
- ✅ Inline data editing with diff preview
- ✅ Interactive ER diagram visualization
- ✅ Query history with search
- ✅ Secure password storage via OS keychain
- ✅ Dark/light theme with system detection

## 🤝 Contribution Priorities

We welcome contributions! Here are the areas where help is most needed:

### High Priority

1. **Testing** - Help improve test coverage for core functionality
2. **Documentation** - Improve user guides and feature documentation
3. **Accessibility** - Ensure WCAG 2.1 AA compliance
4. **Localization** - Translate UI to additional languages

### Medium Priority

1. **Performance** - Profile and optimize rendering for large datasets
2. **UI/UX** - Improve user experience and visual polish
3. **Cross-platform** - Test and fix platform-specific issues

### Low Priority (Future)

1. **Plugin Development** - Build plugins once the plugin system is ready
2. **Theme Creation** - Create additional color themes
3. **Integration** - Build integrations with other developer tools

## 📊 Status Legend

| Icon | Meaning             |
| ---- | ------------------- |
| ✅   | Completed           |
| 🚧   | In Progress         |
| 🔜   | Planned             |
| 💡   | Under Consideration |

## 💬 Feedback

We value community input on our roadmap. To suggest features or provide feedback:

- Open a [GitHub Discussion](https://github.com/kunish-homelab/sql-pro/discussions) for feature ideas
- Create an [Issue](https://github.com/kunish-homelab/sql-pro/issues) for specific bug reports
- Join the conversation in existing roadmap discussions

## 📅 Release Schedule

We aim to release updates on a monthly cadence:

- **Minor releases** (1.x.0): New features, typically monthly
- **Patch releases** (1.x.y): Bug fixes, as needed
- **Major releases** (x.0.0): Breaking changes or major milestones

---

_Last updated: December 2025_

_Note: This roadmap is subject to change based on community feedback, contributor availability, and technical constraints. Features may be added, removed, or reprioritized._
