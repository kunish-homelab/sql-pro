# Quickstart: Connection Settings Management

**Feature**: 004-connection-settings
**Date**: 2025-12-26

## Overview

This guide provides a quick reference for implementing the Connection Settings Management feature.

## Prerequisites

- Existing codebase with WelcomeScreen, PasswordDialog, and connection store
- Radix UI components installed (@radix-ui/react-dialog, @radix-ui/react-dropdown-menu)
- Understanding of Electron IPC patterns used in the project

## Implementation Order

### Phase 1: Backend (Main Process)

1. **Extend Types** (`src/shared/types.ts`)
   - Add `displayName`, `readOnly`, `createdAt` to `RecentConnection`
   - Add `UpdateConnectionRequest/Response`
   - Add `RemoveConnectionRequest/Response`
   - Add IPC channel constants

2. **Add IPC Handlers** (`src/main/ipc/handlers.ts`)
   - `connection:update` handler
   - `connection:remove` handler

3. **Extend Preferences Service** (`src/main/services/preferences.ts`)
   - `updateConnection(path, updates)` method
   - `removeConnection(path)` method

### Phase 2: Bridge (Preload)

4. **Expose New APIs** (`src/preload/index.ts`)
   - Add `connection.update()` method
   - Add `connection.remove()` method

5. **Update Type Declarations** (`src/preload/index.d.ts`)
   - Add connection API types to SqlProAPI

### Phase 3: Frontend (Renderer)

6. **ConnectionSettingsDialog** (`src/renderer/src/components/ConnectionSettingsDialog.tsx`)
   - Form with displayName, readOnly, rememberPassword
   - Reusable for both new connections and editing

7. **InlineRename** (`src/renderer/src/components/InlineRename.tsx`)
   - Controlled input for inline editing
   - Enter to confirm, Escape to cancel

8. **Update WelcomeScreen** (`src/renderer/src/components/WelcomeScreen.tsx`)
   - Add context menu with Edit, Rename, Remove options
   - Integrate ConnectionSettingsDialog
   - Show displayName instead of filename when available

9. **Update Connection Store** (`src/renderer/src/stores/connection-store.ts`)
   - Update `recentConnections` type
   - Add actions for local state updates

## Key Code Snippets

### Context Menu on WelcomeScreen

```tsx
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

// In the recent connection item
<DropdownMenu.Root>
  <DropdownMenu.Trigger asChild>
    <button className="...">
      <MoreVertical className="h-4 w-4" />
    </button>
  </DropdownMenu.Trigger>
  <DropdownMenu.Portal>
    <DropdownMenu.Content>
      <DropdownMenu.Item onSelect={() => handleEdit(conn)}>
        Edit Settings
      </DropdownMenu.Item>
      <DropdownMenu.Item onSelect={() => handleRename(conn)}>
        Rename
      </DropdownMenu.Item>
      <DropdownMenu.Separator />
      <DropdownMenu.Item
        onSelect={() => handleRemove(conn)}
        className="text-destructive"
      >
        Remove from List
      </DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>;
```

### Settings Dialog Form

```tsx
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Connection Settings</DialogTitle>
    </DialogHeader>
    <form onSubmit={handleSubmit}>
      <div className="space-y-4">
        <div>
          <Label htmlFor="displayName">Display Name</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={filename}
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="readOnly"
            checked={readOnly}
            onCheckedChange={setReadOnly}
          />
          <Label htmlFor="readOnly">Open in Read-Only Mode</Label>
        </div>
        {isEncrypted && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="rememberPassword"
              checked={rememberPassword}
              onCheckedChange={setRememberPassword}
            />
            <Label htmlFor="rememberPassword">Remember Password</Label>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{isEditing ? 'Save' : 'Save & Connect'}</Button>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
```

### IPC Handler

```typescript
// In src/main/ipc/handlers.ts
ipcMain.handle(
  IPC_CHANNELS.CONNECTION_UPDATE,
  async (_, request: UpdateConnectionRequest) => {
    try {
      await preferencesService.updateConnection(request.path, {
        displayName: request.displayName,
        readOnly: request.readOnly,
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
);
```

## Testing Checklist

- [ ] Open new database → settings dialog appears
- [ ] Save connection with custom name → name appears in list
- [ ] Edit existing connection → settings persist
- [ ] Rename via context menu → inline edit works
- [ ] Remove connection → removed from list
- [ ] Remove encrypted connection → password also removed
- [ ] Click saved connection → connects with saved settings
- [ ] Read-only mode → database opens read-only
- [ ] Keyboard navigation → all actions accessible

## Common Issues

| Issue                      | Solution                            |
| -------------------------- | ----------------------------------- |
| Context menu not appearing | Check `onContextMenu` event handler |
| Display name not saving    | Verify IPC handler registered       |
| Password not remembered    | Check keychain availability         |
| Read-only not working      | Verify `readOnly` passed to db.open |
