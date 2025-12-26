# Contracts: Theme Settings

**Feature**: 001-theme-settings
**Date**: 2025-12-26

## IPC Contracts

No new IPC contracts needed. This feature uses existing contracts:

### `app:getPreferences`

**Existing in**: `src/shared/types.ts`

```typescript
// Request: none (no parameters)

// Response
interface GetPreferencesResponse {
  success: boolean;
  preferences?: Preferences; // Includes theme: 'light' | 'dark' | 'system'
}
```

### `app:setPreferences`

**Existing in**: `src/shared/types.ts`

```typescript
// Request
interface SetPreferencesRequest {
  preferences: Partial<Preferences>; // Can update just { theme: 'dark' }
}

// Response
interface SetPreferencesResponse {
  success: boolean;
  error?: string;
}
```

## Type Definitions

All types already exist in `src/shared/types.ts`:

```typescript
interface Preferences {
  theme: 'light' | 'dark' | 'system'; // ✅ Already defined
  defaultPageSize: number;
  confirmBeforeApply: boolean;
  recentConnectionsLimit: number;
}
```

## No New Contracts Required

The existing IPC infrastructure fully supports the theme settings feature:

- ✅ Theme preference type defined
- ✅ Get preferences endpoint exists
- ✅ Set preferences endpoint exists (with partial update support)
- ✅ Preload bridge already exposes these methods
