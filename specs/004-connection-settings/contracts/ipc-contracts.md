# IPC Contracts: Connection Settings Management

**Feature**: 004-connection-settings
**Date**: 2025-12-26
**Protocol**: Electron IPC (invoke/handle)

## Overview

This feature adds two new IPC channels to manage connection profiles:

- `connection:update` - Update profile settings
- `connection:remove` - Remove profile from recent list

## Channel Definitions

### connection:update

Updates an existing connection profile's settings.

**Channel Name**: `connection:update`
**Direction**: Renderer → Main
**Pattern**: Request/Response (invoke/handle)

#### Request

```typescript
interface UpdateConnectionRequest {
  /** Absolute path to database file (profile identifier) */
  path: string;

  /** New display name (optional, keeps existing if not provided) */
  displayName?: string;

  /** New read-only setting (optional, keeps existing if not provided) */
  readOnly?: boolean;
}
```

#### Response

```typescript
interface UpdateConnectionResponse {
  /** Whether the update succeeded */
  success: boolean;

  /** Error message if success is false */
  error?: string;
}
```

#### Error Codes

| Error                  | Cause                            | Resolution                   |
| ---------------------- | -------------------------------- | ---------------------------- |
| `CONNECTION_NOT_FOUND` | No profile exists for given path | Save connection first        |
| `INVALID_DISPLAY_NAME` | Display name empty or too long   | Use 1-100 characters         |
| `STORAGE_ERROR`        | Failed to write preferences      | Check disk space/permissions |

#### Example

```typescript
// Renderer
const result = await window.sqlPro.connection.update({
  path: '/Users/demo/databases/customers.db',
  displayName: 'Customer DB (Production)',
  readOnly: true,
});

if (!result.success) {
  console.error('Update failed:', result.error);
}
```

---

### connection:remove

Removes a connection profile from the recent list.

**Channel Name**: `connection:remove`
**Direction**: Renderer → Main
**Pattern**: Request/Response (invoke/handle)

#### Request

```typescript
interface RemoveConnectionRequest {
  /** Absolute path to database file (profile identifier) */
  path: string;

  /** If true, also removes saved password from keychain */
  removePassword?: boolean;
}
```

#### Response

```typescript
interface RemoveConnectionResponse {
  /** Whether the removal succeeded */
  success: boolean;

  /** Error message if success is false */
  error?: string;
}
```

#### Error Codes

| Error                     | Cause                            | Resolution                       |
| ------------------------- | -------------------------------- | -------------------------------- |
| `CONNECTION_NOT_FOUND`    | No profile exists for given path | Already removed                  |
| `PASSWORD_REMOVAL_FAILED` | Keychain operation failed        | Warn user, profile still removed |
| `STORAGE_ERROR`           | Failed to write preferences      | Check disk space/permissions     |

#### Example

```typescript
// Renderer
const result = await window.sqlPro.connection.remove({
  path: '/Users/demo/databases/old.db',
  removePassword: true, // Clean up saved password too
});

if (result.success) {
  // Update UI to remove from list
}
```

---

## IPC Channel Constants

Add to `src/shared/types.ts`:

```typescript
export const IPC_CHANNELS = {
  // ... existing channels ...

  // Connection profile operations
  CONNECTION_UPDATE: 'connection:update',
  CONNECTION_REMOVE: 'connection:remove',
} as const;
```

## Preload Bridge

Add to `src/preload/index.ts`:

```typescript
const sqlProAPI = {
  // ... existing APIs ...

  connection: {
    update: (
      request: UpdateConnectionRequest
    ): Promise<UpdateConnectionResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.CONNECTION_UPDATE, request),
    remove: (
      request: RemoveConnectionRequest
    ): Promise<RemoveConnectionResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.CONNECTION_REMOVE, request),
  },
};
```

## Type Exports

Add to `src/shared/types.ts`:

```typescript
// Connection Profile Operations
export interface UpdateConnectionRequest {
  path: string;
  displayName?: string;
  readOnly?: boolean;
}

export interface UpdateConnectionResponse {
  success: boolean;
  error?: string;
}

export interface RemoveConnectionRequest {
  path: string;
  removePassword?: boolean;
}

export interface RemoveConnectionResponse {
  success: boolean;
  error?: string;
}
```
