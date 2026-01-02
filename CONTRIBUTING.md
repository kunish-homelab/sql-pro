# Contributing to SQL Pro

Thank you for your interest in contributing to SQL Pro! We welcome contributions from the community and are grateful for any help you can provide.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Documentation](#documentation)
- [Community](#community)

## Code of Conduct

This project adheres to a Code of Conduct that all contributors are expected to follow. Please read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before contributing.

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 20 or later
- **pnpm** 10 or later
- **Git**

Optional (for icon generation):
- **ImageMagick**
- **librsvg**

### Development Setup

1. **Fork the repository** on GitHub

2. **Clone your fork:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/sql-pro.git
   cd sql-pro
   ```

3. **Add upstream remote:**
   ```bash
   git remote add upstream https://github.com/kunish-homelab/sql-pro.git
   ```

4. **Install dependencies:**
   ```bash
   pnpm install
   ```

5. **Start development server:**
   ```bash
   pnpm dev
   ```

The application should now be running with hot-reload enabled.

## Making Changes

### Branch Naming

Create a descriptive branch for your changes:

- `feature/add-export-json` - New features
- `fix/query-editor-crash` - Bug fixes
- `docs/update-readme` - Documentation updates
- `refactor/improve-store` - Code refactoring
- `test/add-utils-tests` - Test additions

```bash
git checkout -b feature/your-feature-name
```

### Code Style

We use automated tools to maintain code quality:

- **ESLint** - JavaScript/TypeScript linting
- **Prettier** - Code formatting
- **TypeScript** - Type checking

Before committing, run:

```bash
pnpm lint        # Check for linting errors
pnpm format      # Format code
pnpm typecheck   # Verify types
```

### Code Conventions

1. **TypeScript**
   - Use explicit types where beneficial
   - Avoid `any` - use `unknown` instead
   - Prefer interfaces over type aliases for objects

2. **React Components**
   - Use functional components with hooks
   - Keep components focused and single-purpose
   - Extract reusable logic into custom hooks

3. **Naming**
   - Components: `PascalCase` (e.g., `DataGrid`)
   - Functions/Variables: `camelCase` (e.g., `executeQuery`)
   - Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_ROWS`)
   - Files: Match component names or use `kebab-case`

4. **File Organization**
   - One component per file
   - Co-locate tests with source files (`.test.ts`)
   - Group related components in directories

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/) for clear commit history:

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, no logic change)
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `chore` - Maintenance tasks
- `perf` - Performance improvements

### Examples

```bash
feat(query-editor): add autocomplete for table names

Implements intelligent autocomplete that suggests table names
as the user types in the query editor.

Closes #123
```

```bash
fix(data-grid): prevent crash on empty result set

Added null check before accessing result data.

Fixes #456
```

### Commit Best Practices

- Use present tense ("add feature" not "added feature")
- Use imperative mood ("move cursor to..." not "moves cursor to...")
- Keep subject line under 72 characters
- Reference issues and PRs in the footer

## Pull Request Process

### Before Submitting

1. **Update your branch** with the latest upstream changes:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run tests:**
   ```bash
   pnpm test:run
   ```

3. **Run linting and type checking:**
   ```bash
   pnpm lint
   pnpm typecheck
   ```

4. **Test the application:**
   - Build and run the application
   - Test your changes thoroughly
   - Verify no regressions in existing features

### Creating a Pull Request

1. **Push your branch:**
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Open a Pull Request** on GitHub with:
   - Clear title describing the change
   - Detailed description of what and why
   - Screenshots/GIFs for UI changes
   - Reference to related issues

### PR Template

```markdown
## Description
Brief description of your changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tests pass locally
- [ ] Added new tests for changes
- [ ] Manual testing completed

## Screenshots (if applicable)
Add screenshots for UI changes

## Related Issues
Closes #123
```

### Review Process

- Maintainers will review your PR
- Address any feedback or requested changes
- Once approved, a maintainer will merge your PR

## Testing

### Running Tests

```bash
# Watch mode (for active development)
pnpm test

# Single run (for verification)
pnpm test:run

# Coverage report
pnpm test:coverage

# Interactive UI
pnpm test:ui
```

### Writing Tests

- Write tests for new features and bug fixes
- Maintain or improve code coverage
- Test edge cases and error conditions
- Use descriptive test names

Example test:

```typescript
import { describe, it, expect } from 'vitest'
import { formatBytes } from './utils'

describe('formatBytes', () => {
  it('formats bytes correctly', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1048576)).toBe('1 MB')
  })

  it('handles negative values', () => {
    expect(formatBytes(-1024)).toBe('-1 KB')
  })
})
```

### Test Coverage Goals

- **Utilities**: 95%+ coverage
- **Stores**: 80%+ coverage
- **Components**: Test critical logic

## Documentation

### Code Documentation

- Add JSDoc comments for public APIs
- Document complex logic inline
- Keep comments up-to-date with code changes

### User Documentation

Documentation is in the `docs/` directory using VitePress:

```bash
# Start docs dev server
pnpm docs:dev

# Build documentation
pnpm docs:build
```

When adding features:
- Update relevant documentation pages
- Add screenshots if UI is involved
- Update the changelog

## Community

### Getting Help

- **GitHub Discussions** - Ask questions, share ideas
- **GitHub Issues** - Report bugs, request features
- **Documentation** - Check [docs](https://kunish-homelab.github.io/sql-pro/)

### Reporting Issues

When reporting bugs, include:

1. **Environment**: OS, SQL Pro version, Node.js version
2. **Steps to reproduce**: Clear, numbered steps
3. **Expected behavior**: What should happen
4. **Actual behavior**: What actually happens
5. **Screenshots/Logs**: If applicable
6. **Database info**: Size, encryption, source app (no sensitive data!)

### Feature Requests

For feature requests, describe:

1. **Problem**: What problem does this solve?
2. **Proposed solution**: How should it work?
3. **Alternatives**: Other solutions you've considered
4. **Use case**: When would you use this feature?

## Recognition

Contributors are recognized in:
- GitHub contributors page
- Release notes for their contributions
- Special acknowledgment for significant contributions

Thank you for contributing to SQL Pro! 🎉

---

## Quick Reference

```bash
# Setup
pnpm install
pnpm dev

# Code Quality
pnpm lint
pnpm format
pnpm typecheck

# Testing
pnpm test
pnpm test:run
pnpm test:coverage

# Building
pnpm build
pnpm build:mac
pnpm build:win
pnpm build:linux

# Documentation
pnpm docs:dev
pnpm docs:build
```

## Questions?

Feel free to ask questions in [GitHub Discussions](https://github.com/kunish-homelab/sql-pro/discussions) or open an issue if you need help getting started!
