# Data Model: Connection Settings Management

**Feature**: 004-connection-settings
**Date**: 2025-12-26

## Entity Overview

```
┌─────────────────────────────────────┐
│         ConnectionProfile           │
├─────────────────────────────────────┤
│ path: string (PK)                   │
│ displayName: string                 │
│ filename: string                    │
│ isEncrypted: boolean                │
│ readOnly: boolean                   │
│ lastOpened: string (ISO 8601)       │
│ createdAt: string (ISO 8601)        │
└─────────────────────────────────────┘
           │
           │ 1:0..1 (path as key)
           ▼
┌─────────────────────────────────────┐
│      System Keychain (External)     │
├─────────────────────────────────────┤
│ service: "sql-pro"                  │
│ account: {path}                     │
│ password: {encrypted by OS}         │
└─────────────────────────────────────┘
```

## Entity Definitions

### ConnectionProfile

Represents a saved database connection with user preferences.

| Field         | Type    | Required | Default  | Description                            |
| ------------- | ------- | -------- | -------- | -------------------------------------- |
| `path`        | string  | Yes      | -        | Absolute file path (unique identifier) |
| `displayName` | string  | Yes      | filename | User-defined display name              |
| `filename`    | string  | Yes      | -        | Original filename from path            |
| `isEncrypted` | boolean | Yes      | false    | Whether database uses SQLCipher        |
| `readOnly`    | boolean | Yes      | false    | Open in read-only mode                 |
| `lastOpened`  | string  | Yes      | -        | ISO 8601 timestamp of last access      |
| `createdAt`   | string  | Yes      | -        | ISO 8601 timestamp of first save       |

**Validation Rules**:

- `path` must be absolute path
- `displayName` must be non-empty, max 100 characters
- `lastOpened` and `createdAt` must be valid ISO 8601 dates

**State Transitions**:

```
[New Database Selected]
        │
        ▼
┌───────────────────┐
│     Transient     │ (not saved yet)
└───────────────────┘
        │
        │ User clicks "Save & Connect"
        ▼
┌───────────────────┐
│      Saved        │ (in preferences)
└───────────────────┘
        │
        │ User removes from list
        ▼
┌───────────────────┐
│     Removed       │ (deleted from preferences + keychain)
└───────────────────┘
```

## Type Definitions (TypeScript)

### Extended RecentConnection

```typescript
// In src/shared/types.ts - extends existing type
export interface RecentConnection {
  // Existing fields
  path: string;
  filename: string;
  isEncrypted: boolean;
  lastOpened: string;

  // New fields (optional for backwards compatibility)
  displayName?: string; // Defaults to filename if not set
  readOnly?: boolean; // Defaults to false
  createdAt?: string; // Set on first save
}
```

### Connection Settings (UI State)

```typescript
// For ConnectionSettingsDialog
export interface ConnectionSettings {
  displayName: string;
  readOnly: boolean;
  rememberPassword: boolean; // UI toggle, not persisted directly
}
```

### Update Request/Response

```typescript
export interface UpdateConnectionRequest {
  path: string; // Identifies which connection
  displayName?: string; // New display name (if changing)
  readOnly?: boolean; // New read-only setting (if changing)
}

export interface UpdateConnectionResponse {
  success: boolean;
  error?: string;
}

export interface RemoveConnectionRequest {
  path: string;
  removePassword?: boolean; // Also delete from keychain
}

export interface RemoveConnectionResponse {
  success: boolean;
  error?: string;
}
```

## Storage Schema

### Preferences (electron-store)

```json
{
  "recentConnections": [
    {
      "path": "/Users/demo/databases/customers.db",
      "displayName": "Customer Database",
      "filename": "customers.db",
      "isEncrypted": true,
      "readOnly": false,
      "lastOpened": "2025-12-26T10:30:00.000Z",
      "createdAt": "2025-12-20T08:00:00.000Z"
    }
  ],
  "preferences": {
    "theme": "system",
    "defaultPageSize": 100,
    "confirmBeforeApply": true,
    "recentConnectionsLimit": 10
  }
}
```

### Keychain (system)

Password stored per database path:

- **Service**: `sql-pro`
- **Account**: `{absolute-path-to-database}`
- **Password**: `{user-entered-password}`

## Migration Strategy

**Backwards Compatibility**: New fields are optional with sensible defaults.

When loading existing connections without new fields:

```typescript
function migrateConnection(conn: RecentConnection): RecentConnection {
  return {
    ...conn,
    displayName: conn.displayName ?? conn.filename,
    readOnly: conn.readOnly ?? false,
    createdAt: conn.createdAt ?? conn.lastOpened, // Use lastOpened as proxy
  };
}
```

No database migration needed—preferences file auto-updates on next save.
