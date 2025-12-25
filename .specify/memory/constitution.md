<!--
## Sync Impact Report
- **Version Change**: N/A → 1.0.0 (Initial ratification)
- **Modified Principles**: None (initial version)
- **Added Sections**:
  - Core Principles (I through IX)
  - Development Workflow section
  - Code Quality Standards section
  - Governance section
- **Removed Sections**: Template placeholders removed
- **Templates Requiring Updates**:
  - `.specify/templates/plan-template.md` ✅ No changes needed (Constitution Check section is generic)
  - `.specify/templates/spec-template.md` ✅ No changes needed (generic template)
  - `.specify/templates/tasks-template.md` ✅ No changes needed (generic template)
- **Follow-up TODOs**: None
-->

# SQL-Pro Constitution

## Core Principles

### I. SQLCipher First

All database operations MUST support encrypted databases via SQLCipher. The application MUST:

- Detect encrypted databases and prompt for password before any read operation
- Offer encryption options when creating new databases
- Support key rotation and password changes without data loss
- Handle encryption errors gracefully with clear user messaging
- Never assume a database is unencrypted

**Rationale**: SQL-Pro targets professional users handling sensitive data. Encryption support is not optional—it is a fundamental capability that differentiates this tool from basic SQLite browsers.

### II. No Data Leakage

Sensitive data MUST never leak outside the intended context. This principle mandates:

- Query contents and results MUST NOT be logged to disk or console in production builds
- Database passwords MUST be held in memory only, never persisted
- Clipboard operations with sensitive data MUST be user-initiated only
- Temporary files (if any) MUST be encrypted and securely deleted
- Error messages MUST NOT expose schema details or data samples

**Rationale**: A database manager has access to all user data. Any logging or caching of this data creates security vulnerabilities and potential compliance violations (GDPR, HIPAA).

### III. Secure by Default

Security features MUST be enabled by default with opt-out rather than opt-in. This includes:

- New database creation MUST prompt for encryption (can be skipped but asked)
- Connection timeout defaults MUST be set (e.g., 5 minutes of inactivity)
- Auto-lock on system sleep or screen lock MUST be the default behavior
- Export operations MUST warn about unencrypted output formats

**Rationale**: Users should not need to be security experts. The application protects them by default; advanced users can disable protections when needed.

### IV. Preview Before Commit

All destructive or data-modifying operations MUST show a diff preview before execution:

- DELETE statements MUST show affected rows before confirmation
- UPDATE statements MUST show before/after values for affected cells
- Schema changes (ALTER, DROP) MUST show impact summary
- Batch operations MUST provide a detailed preview or dry-run mode
- The preview MUST be accurate—what you see is what will happen

**Rationale**: Database operations are often irreversible. Preview-based workflows prevent accidental data loss and build user trust in the tool.

### V. Performance First

Large datasets MUST be handled without UI freezing or excessive memory consumption:

- Table views MUST use virtualized rendering (only visible rows in DOM)
- Query execution MUST be asynchronous with cancellation support
- Large result sets MUST support pagination or streaming
- Memory usage MUST remain bounded regardless of database size
- UI MUST remain responsive during long operations (show progress indicators)

**Rationale**: Professional databases can contain millions of rows. The UI must degrade gracefully, not crash or freeze.

### VI. Accessibility

The application MUST be usable by all users regardless of ability:

- Full keyboard navigation MUST be supported for all features
- Focus management MUST be logical and predictable
- Color MUST NOT be the only differentiator (use icons, text, patterns)
- Interactive elements MUST meet minimum contrast ratios (WCAG AA)
- Screen reader compatibility MUST be maintained for core workflows

**Rationale**: Accessibility is not an afterthought—it is a professional requirement. Many enterprise environments mandate WCAG compliance.

### VII. Type Safety

TypeScript strict mode MUST be enforced across all code:

- `strict: true` in all tsconfig files with no exceptions
- `any` type MUST NOT be used except with explicit `// @ts-expect-error` justification
- All function parameters and returns MUST have explicit types
- IPC channels MUST have typed request/response contracts
- Database query results MUST be typed (no raw object assumptions)

**Rationale**: Type safety catches bugs at compile time. In a database tool where data integrity matters, runtime type errors are unacceptable.

### VIII. Component Isolation

Electron's process architecture MUST be respected with strict boundaries:

- **Main Process**: Database operations, file system access, encryption
- **Renderer Process**: UI only, no direct Node.js API access
- **Preload Scripts**: Minimal bridge exposing only necessary APIs
- IPC contracts MUST be explicitly defined and versioned
- No `nodeIntegration: true` or `contextIsolation: false` in any window

**Rationale**: This architecture provides security (renderer compromise doesn't expose full system) and maintainability (clear separation of concerns).

### IX. Test Coverage

All features MUST have corresponding tests before implementation:

- Contract tests for IPC channels (main ↔ renderer communication)
- Unit tests for business logic (query parsing, diff generation)
- Integration tests for database operations (CRUD, encryption)
- Visual regression tests for critical UI components (optional but encouraged)
- Tests MUST fail before implementation (TDD red-green-refactor)

**Rationale**: A database tool handles user data. Untested code is a liability. TDD ensures tests exist and verify actual requirements.

## Development Workflow

### Commit Standards

All commits MUST follow the Conventional Commits specification:

- Format: `<type>(<scope>): <description>`
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- Breaking changes MUST include `BREAKING CHANGE:` in body or `!` after type
- Scope SHOULD reference affected area (e.g., `feat(encryption):`, `fix(table-view):`)

### Pre-commit Enforcement

The following checks MUST pass before any commit:

- ESLint with zero errors (warnings allowed but discouraged)
- Prettier formatting applied
- TypeScript compilation with no errors
- Husky hooks MUST NOT be bypassed (`--no-verify` prohibited in standard workflow)

### Pull Request Requirements

All changes to main branch MUST go through pull request:

- PR description MUST explain what and why
- At least one approval required for merge
- All CI checks MUST pass
- Squash merge preferred for clean history

## Code Quality Standards

### File Organization

```
src/
├── main/           # Main process (Node.js context)
│   ├── database/   # SQLite/SQLCipher operations
│   ├── ipc/        # IPC handlers
│   └── services/   # Business logic
├── preload/        # Preload scripts (bridge)
├── renderer/       # React UI (browser context)
│   ├── components/ # Reusable UI components
│   ├── pages/      # Route-level components
│   ├── hooks/      # Custom React hooks
│   └── stores/     # Zustand state management
└── shared/         # Types and constants shared across processes
```

### Naming Conventions

- Files: `kebab-case.ts` for utilities, `PascalCase.tsx` for React components
- Types/Interfaces: `PascalCase` with `I` prefix optional (prefer without)
- Constants: `SCREAMING_SNAKE_CASE`
- IPC Channels: `domain:action` format (e.g., `database:query`, `file:open`)

## Governance

### Constitutional Authority

This constitution supersedes all other development practices. Any deviation MUST be:

1. Explicitly documented in code comments or PR description
2. Justified with technical rationale
3. Tracked in the Complexity Tracking section of the relevant plan.md
4. Approved by project maintainer(s)

### Amendment Process

To amend this constitution:

1. Propose change via pull request to `.specify/memory/constitution.md`
2. Document rationale for change
3. Update version number following semantic versioning:
   - **MAJOR**: Removal or fundamental redefinition of principles
   - **MINOR**: New principles or significant expansions
   - **PATCH**: Clarifications, typo fixes, non-semantic changes
4. Update `LAST_AMENDED_DATE` to current date
5. Propagate changes to dependent templates if necessary

### Compliance Review

All pull requests SHOULD be reviewed for constitutional compliance:

- Security principles (I, II, III) are non-negotiable
- UX principles (IV, V, VI) may have justified exceptions for edge cases
- Quality principles (VII, VIII, IX) violations require explicit justification

### Runtime Guidance

For day-to-day development guidance beyond constitutional principles, refer to:

- `CLAUDE.md` for AI assistant instructions
- `README.md` for project setup and contribution guidelines
- `.specify/templates/` for feature development workflows

**Version**: 1.0.0 | **Ratified**: 2025-12-26 | **Last Amended**: 2025-12-26
