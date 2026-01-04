# Copilot Instructions for SQL Pro

## Project Overview

SQL Pro is a professional SQLite database manager built with Electron, React, and TypeScript. It provides a rich desktop application for managing both regular SQLite and encrypted SQLCipher databases with features including an SQL editor, schema browser, inline editing, diff preview, and ER diagrams.

### Key Technologies

- **Frontend**: React 19, TanStack Router, TanStack Table, Monaco Editor
- **Backend**: Electron 39, better-sqlite3-multiple-ciphers
- **Styling**: Tailwind CSS 4, shadcn/ui components
- **State Management**: Zustand
- **Testing**: Vitest with happy-dom
- **Build**: Electron Vite, electron-builder

## Architecture

```
src/
├── main/           # Electron main process (Node.js)
│   └── services/   # Database operations, IPC handlers, plugin system
├── preload/        # Preload scripts (bridge between main and renderer)
├── renderer/       # React frontend application
│   ├── components/ # UI components (shadcn/ui based)
│   ├── stores/     # Zustand state stores
│   └── routes/     # TanStack Router routes
└── shared/         # Shared types and utilities
```

### Design Principles

- **Electron Architecture**: Maintain strict separation between main process (Node.js), preload (IPC bridge), and renderer (React). Never import Node.js modules directly in renderer code.
- **Type Safety**: Use TypeScript strictly. Ensure all IPC handlers have proper type definitions in shared types.
- **Component Structure**: Follow shadcn/ui patterns. Components should be in `components/ui/` for base components and `components/` for feature components.
- **State Management**: Use Zustand stores for global state. Each store should be focused on a specific domain (theme, connection, query, settings).

## Code Style and Formatting

### Formatting Tools

- **Prettier**: Run `pnpm format` to format all files
  - Semi-colons: Required
  - Quotes: Single quotes
  - Tab width: 2 spaces
  - Trailing commas: ES5
  - Print width: 80 characters
  - Tailwind plugin: Enabled for class sorting
- **ESLint**: Run `pnpm lint` to check and fix linting issues
  - Configuration: @antfu/eslint-config with React support
  - Formatters disabled (handled by Prettier)
  - Stylistic rules disabled (handled by Prettier)

### Conventions

- **Imports**: Use `@/` for renderer imports, `@shared/` for shared code
- **File Naming**:
  - Components: PascalCase (e.g., `TableView.tsx`)
  - Utilities: kebab-case (e.g., `filter-utils.ts`)
  - Stores: kebab-case with `-store` suffix (e.g., `theme-store.ts`)
  - Tests: Same name as source file with `.test.ts` or `.test.tsx`
- **Component Style**:
  - Use functional components with hooks
  - Prefer named exports for components
  - Use TypeScript interfaces for props
  - Keep components focused and single-purpose

## Testing

### Test Framework

- **Framework**: Vitest with happy-dom environment
- **Testing Library**: @testing-library/react for component tests
- **Commands**:
  - `pnpm test`: Run tests in watch mode
  - `pnpm test:run`: Run tests once (CI mode)
  - `pnpm test:coverage`: Run with coverage report
  - `pnpm test:ui`: Open interactive Vitest UI

### Testing Standards

- **Coverage Targets**: 80%+ for utilities and core logic
- **Test Location**: Co-located with source files (e.g., `utils.test.ts` next to `utils.ts`)
- **Test Structure**:
  - Use `describe` blocks to group related tests
  - Use descriptive test names with `it('should ...')`
  - Test both happy paths and edge cases
  - Mock external dependencies appropriately

### Test Areas

Priority test coverage:

1. **Utilities** (`lib/utils.ts`, `lib/filter-utils.ts`): Comprehensive unit tests
2. **SQL Logic** (`lib/monaco-sql-config.ts`): Parser and formatter tests
3. **State Management** (`stores/*.ts`): Test all actions and state updates
4. **Services** (`main/services/*.ts`): Test database operations and IPC handlers

## Development Workflow

### Getting Started

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Run with mock data (for demos/screenshots)
pnpm dev:mock
```

### Development Commands

- `pnpm dev`: Start development server with hot reload
- `pnpm build`: Build for production
- `pnpm lint`: Run ESLint (auto-fix)
- `pnpm format`: Format code with Prettier
- `pnpm typecheck`: Run TypeScript type checking (all)
- `pnpm typecheck:main`: Check main process types
- `pnpm typecheck:renderer`: Check renderer process types
- `pnpm test`: Run tests in watch mode
- `pnpm test:run`: Run tests once

### Build Commands

- `pnpm build:mac`: Build macOS application
- `pnpm build:win`: Build Windows application
- `pnpm build:linux`: Build Linux application
- `pnpm build:unpack`: Build without packaging (for testing)

### Pre-commit Hooks

The project uses Husky and lint-staged:

- Automatically runs ESLint and Prettier on staged files
- Validates commit messages with commitlint
- Configured in `.husky/` and `.lintstagedrc.yml`

## Commit Message Convention

Follow **Conventional Commits** specification (enforced by commitlint):

```
<type>(<scope>): <subject>

<body>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks, dependency updates
- `ci`: CI/CD changes

### Examples

```
feat(query-editor): add vim mode support
fix(database): resolve SQLCipher password validation issue
docs(readme): update installation instructions
test(utils): add edge cases for filter utilities
```

### Scope Guidelines

Common scopes in this project:

- `query-editor`: Monaco SQL editor features
- `database`: Database connection and operations
- `schema`: Schema browser and comparison
- `ui`: UI components and theming
- `plugin`: Plugin system
- `er-diagram`: Entity-relationship diagram
- `data-editing`: Table data editing features

## Plugin System

SQL Pro has a plugin system for extending functionality:

- **Plugin SDK**: Located in `packages/plugin-sdk/`
- **Templates**: Available in `packages/plugin-sdk/templates/`
- **Types**: Query hooks, menu commands, custom panels
- **Development**: See `packages/docs/plugin-development.md`

When working with plugins:

- Plugins run in sandboxed environments
- Use the Plugin API defined in `src/main/services/plugin/`
- Test plugin integration thoroughly
- Follow security best practices for plugin execution

## Common Patterns

### IPC Communication

```typescript
// Main process (handler)
ipcMain.handle('database:query', async (_, sql: string) => {
  return await database.execute(sql);
});

// Renderer process (invocation)
const result = await window.electron.ipcRenderer.invoke('database:query', sql);
```

### Zustand Store

```typescript
interface MyStore {
  value: string;
  setValue: (value: string) => void;
}

export const useMyStore = create<MyStore>((set) => ({
  value: '',
  setValue: (value) => set({ value }),
}));
```

### React Component with shadcn/ui

```typescript
import { Button } from '@/components/ui/button';

interface MyComponentProps {
  title: string;
  onAction: () => void;
}

export function MyComponent({ title, onAction }: MyComponentProps) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <Button onClick={onAction}>Click Me</Button>
    </div>
  );
}
```

## Documentation

- **User Docs**: VitePress documentation in `packages/docs/`
- **Commands**:
  - `pnpm docs:dev`: Start docs dev server
  - `pnpm docs:build`: Build documentation
- **Screenshots**: Automated with `pnpm screenshots` command

When updating features, update corresponding documentation in `packages/docs/` directory.

## Performance Considerations

- **Large Result Sets**: Use virtualization (TanStack Virtual) for large data tables
- **SQL Execution**: Run database queries in main process, never in renderer
- **Monaco Editor**: Lazy load and optimize for large SQL files
- **ER Diagram**: Use canvas rendering for complex diagrams with many nodes

## Security Guidelines

- **Database Passwords**: Store in system keychain (Electron Store with encryption)
- **SQL Injection**: Use parameterized queries with better-sqlite3
- **Plugin Security**: Plugins run in sandboxed environments with limited API access
- **IPC Security**: Validate all IPC inputs in main process handlers

## Common Tasks

### Adding a New Feature

1. Design the UI in `src/renderer/src/components/`
2. Create/update Zustand store if state management needed
3. Implement IPC handlers in `src/main/services/` if main process access required
4. Add types to `src/shared/` for IPC communication
5. Write tests for new functionality
6. Update documentation in `packages/docs/`
7. Test in development mode with `pnpm dev`

### Fixing a Bug

1. Write a failing test that reproduces the bug
2. Implement the fix
3. Verify the test passes
4. Run full test suite with `pnpm test:run`
5. Test manually in development mode
6. Commit with appropriate type (`fix`)

### Updating Dependencies

1. Check for breaking changes in package changelogs
2. Update `package.json` or use `pnpm update <package>`
3. Run `pnpm install`
4. Run tests: `pnpm test:run`
5. Run type checking: `pnpm typecheck`
6. Test application: `pnpm dev`
7. Commit with `chore(deps): update <package>` message

## Resources

- **Main Docs**: https://kunish-homelab.github.io/sql-pro/
- **Repository**: https://github.com/kunish-homelab/sql-pro
- **Issue Tracker**: Use GitHub Issues for bugs and feature requests
- **Roadmap**: See `packages/docs/ROADMAP.md` for planned features
