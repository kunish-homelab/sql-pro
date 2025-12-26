# Research: Connection Settings Management

**Feature**: 004-connection-settings
**Date**: 2025-12-26
**Purpose**: Document technical decisions and existing infrastructure analysis

## Executive Summary

The connection settings feature builds on existing, well-established infrastructure. Research confirms no new dependencies are required—all functionality can be achieved by extending current patterns.

## Existing Infrastructure Analysis

### 1. Recent Connections Storage

**Current Implementation**: `src/main/services/preferences.ts` using electron-store

**Decision**: Extend existing `RecentConnection` type
**Rationale**:

- electron-store already handles persistence
- Adding fields to existing type is backwards-compatible
- Simpler than creating new storage layer

**Fields to Add**:

- `displayName?: string` - Custom name (optional, defaults to filename)
- `readOnly?: boolean` - Read-only preference (optional, defaults to false)
- `createdAt?: string` - When first connected (optional for migration)

### 2. Password Storage

**Current Implementation**: `src/main/services/password.ts` using system keychain

**Decision**: No changes needed
**Rationale**:

- Keychain integration already complete
- `rememberPassword` setting is implicit (password exists = remember)
- Password save/get/remove operations already available

### 3. IPC Architecture

**Current Implementation**: Typed IPC channels in `src/shared/types.ts`

**Decision**: Add new channels for connection profile operations
**Rationale**:

- Follows established `domain:action` naming convention
- Maintains type safety with request/response contracts
- Keeps renderer isolated from storage details

**New Channels**:

- `connection:update` - Update connection profile (rename, settings)
- `connection:remove` - Remove from recent list (with optional password deletion)

### 4. Dialog Patterns

**Current Implementation**: `PasswordDialog.tsx` using Radix Dialog

**Decision**: Create `ConnectionSettingsDialog.tsx` following same pattern
**Rationale**:

- Consistent UX with existing dialogs
- Radix provides accessibility out of the box
- Form validation patterns already established

## Design Decisions

### D1: Settings Dialog vs. Inline Editing

**Decision**: Settings dialog for new connections + inline rename for quick edits
**Alternatives Considered**:

1. Dialog-only: Requires more clicks for simple rename
2. Inline-only: Complex for multi-field editing
3. Hybrid (chosen): Best of both worlds

### D2: Connection Profile Identity

**Decision**: Use `path` as unique identifier
**Rationale**:

- File path is naturally unique on a system
- Avoids UUID generation complexity
- Matches current RecentConnection implementation

**Trade-off**: If database is moved, it becomes a "new" connection. This is acceptable because:

- File system operations are outside app scope
- User can re-save settings if needed

### D3: Context Menu Implementation

**Decision**: Use Radix DropdownMenu for context menu
**Rationale**:

- Already a project dependency
- Full keyboard accessibility
- Consistent with desktop app conventions

**Implementation Note**: Trigger on right-click via `onContextMenu` event.

### D4: Read-Only Mode Handling

**Decision**: Pass `readOnly` flag through existing `OpenDatabaseRequest`
**Rationale**:

- `OpenDatabaseRequest.readOnly` already exists in types
- better-sqlite3 supports `readonly: true` option natively
- No backend changes needed—just wire through UI

## Risk Assessment

| Risk                          | Likelihood | Impact | Mitigation                                     |
| ----------------------------- | ---------- | ------ | ---------------------------------------------- |
| Breaking existing connections | Low        | High   | Add fields as optional, provide defaults       |
| Keychain unavailable          | Low        | Medium | Already handled—show warning, disable remember |
| Context menu focus issues     | Medium     | Low    | Use Radix built-in focus management            |

## Dependencies Confirmation

| Dependency                    | Version    | Purpose             | Status               |
| ----------------------------- | ---------- | ------------------- | -------------------- |
| @radix-ui/react-dialog        | 1.1.15     | Settings dialog     | ✅ Already installed |
| @radix-ui/react-dropdown-menu | 2.1.16     | Context menu        | ✅ Already installed |
| zustand                       | 5.0.9      | State management    | ✅ Already installed |
| electron-store                | (via main) | Preferences storage | ✅ Already installed |

## Conclusion

No new dependencies or architectural changes required. Feature can be implemented by:

1. Extending existing types with optional fields
2. Adding two new IPC channels
3. Creating two new UI components
4. Updating WelcomeScreen with context menu

Estimated complexity: **Low-Medium** (mostly UI work with minimal backend changes)
