import type { RecentConnection } from '@shared/types';
import type { DatabaseConnection } from '@/types/database';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@sqlpro/ui/command';
import { Check, Clock, Database } from 'lucide-react';
import { useCallback, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  useConnectionStore,
  useConnectionSwitcherStore,
  useUIFont,
} from '@/stores';

interface ConnectionSwitcherProps {
  onOpenRecentConnection?: (
    path: string,
    isEncrypted: boolean,
    readOnly?: boolean
  ) => void;
}

interface ConnectionItem {
  id: string;
  label: string;
  path: string;
  isOpen: boolean;
  isActive: boolean;
  isEncrypted?: boolean;
  readOnly?: boolean;
  lastOpened?: string;
}

export function ConnectionSwitcher({
  onOpenRecentConnection,
}: ConnectionSwitcherProps) {
  // Store selectors
  const isOpen = useConnectionSwitcherStore((s) => s.isOpen);
  const search = useConnectionSwitcherStore((s) => s.search);
  const selectedIndex = useConnectionSwitcherStore((s) => s.selectedIndex);
  const close = useConnectionSwitcherStore((s) => s.close);
  const setSearch = useConnectionSwitcherStore((s) => s.setSearch);
  const setSelectedIndex = useConnectionSwitcherStore(
    (s) => s.setSelectedIndex
  );
  const moveSelection = useConnectionSwitcherStore((s) => s.moveSelection);

  // Connection store
  const connections = useConnectionStore((s) => s.connections);
  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId);
  const setActiveConnection = useConnectionStore((s) => s.setActiveConnection);
  const recentConnections = useConnectionStore((s) => s.recentConnections);

  // Get UI font settings
  const uiFont = useUIFont();

  // Build connection items list
  const connectionItems = useMemo(() => {
    const items: ConnectionItem[] = [];

    // Add open connections first
    const openConnections = Array.from(connections.values());
    const openPaths = new Set(openConnections.map((c) => c.path));

    openConnections.forEach((conn: DatabaseConnection) => {
      items.push({
        id: conn.id,
        label: conn.filename || conn.path,
        path: conn.path,
        isOpen: true,
        isActive: conn.id === activeConnectionId,
        isEncrypted: conn.isEncrypted,
        readOnly: conn.isReadOnly,
      });
    });

    // Add recent connections that are not currently open
    recentConnections
      .filter((rc: RecentConnection) => !openPaths.has(rc.path))
      .forEach((rc: RecentConnection) => {
        items.push({
          id: `recent-${rc.path}`,
          label: rc.filename || rc.path,
          path: rc.path,
          isOpen: false,
          isActive: false,
          isEncrypted: rc.isEncrypted,
          readOnly: rc.readOnly,
          lastOpened: rc.lastOpened,
        });
      });

    return items;
  }, [connections, activeConnectionId, recentConnections]);

  // Filter connections based on search
  const filteredItems = useMemo(() => {
    if (!search.trim()) {
      return connectionItems;
    }

    const query = search.toLowerCase().trim();
    return connectionItems.filter(
      (item) =>
        item.label.toLowerCase().includes(query) ||
        item.path.toLowerCase().includes(query)
    );
  }, [connectionItems, search]);

  // Group items by open/recent
  const groupedItems = useMemo(() => {
    const openItems = filteredItems.filter((item) => item.isOpen);
    const recentItems = filteredItems.filter((item) => !item.isOpen);
    return { openItems, recentItems };
  }, [filteredItems]);

  // Handle connection select
  const handleSelect = useCallback(
    (item: ConnectionItem) => {
      close();
      if (item.isOpen) {
        // Switch to already open connection
        setActiveConnection(item.id);
      } else {
        // Open recent connection
        onOpenRecentConnection?.(
          item.path,
          item.isEncrypted ?? false,
          item.readOnly
        );
      }
    },
    [close, setActiveConnection, onOpenRecentConnection]
  );

  // Handle dialog open state change
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        close();
      }
    },
    [close]
  );

  // Reset search when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
    }
  }, [isOpen, setSearch, setSelectedIndex]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveSelection('down', filteredItems.length - 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveSelection('up', filteredItems.length - 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = filteredItems[selectedIndex];
        if (item) {
          handleSelect(item);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, moveSelection, handleSelect]);

  // Font style for dialog content
  const fontStyle = {
    fontFamily: uiFont.family
      ? `"${uiFont.family}", system-ui, sans-serif`
      : undefined,
    fontSize: `${uiFont.size}px`,
  };

  // Format last opened date
  const formatLastOpened = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="overflow-hidden p-0"
        style={fontStyle}
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Switch Connection</DialogTitle>
        <Command
          className="**:[[cmdk-group-heading]]:text-muted-foreground **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group]]:px-2"
          shouldFilter={false}
        >
          <CommandInput
            placeholder="Search connections..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-75">
            <CommandEmpty>No connections found</CommandEmpty>

            {/* Open connections */}
            {groupedItems.openItems.length > 0 && (
              <CommandGroup heading="Open Connections">
                {groupedItems.openItems.map((item, index) => (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={() => handleSelect(item)}
                    className={cn(
                      'gap-3',
                      index === selectedIndex && 'bg-accent'
                    )}
                  >
                    <Database className="text-muted-foreground h-4 w-4 shrink-0" />
                    <div className="flex flex-1 flex-col overflow-hidden">
                      <span className="truncate">{item.label}</span>
                      <span className="text-muted-foreground truncate text-xs">
                        {item.path}
                      </span>
                    </div>
                    {item.isActive && (
                      <Check className="text-primary h-4 w-4 shrink-0" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Recent connections */}
            {groupedItems.recentItems.length > 0 && (
              <CommandGroup heading="Recent Connections">
                {groupedItems.recentItems.map((item, index) => {
                  const actualIndex = groupedItems.openItems.length + index;
                  return (
                    <CommandItem
                      key={item.id}
                      value={item.id}
                      onSelect={() => handleSelect(item)}
                      className={cn(
                        'gap-3',
                        actualIndex === selectedIndex && 'bg-accent'
                      )}
                    >
                      <Clock className="text-muted-foreground h-4 w-4 shrink-0" />
                      <div className="flex flex-1 flex-col overflow-hidden">
                        <span className="truncate">{item.label}</span>
                        <span className="text-muted-foreground truncate text-xs">
                          {item.path}
                        </span>
                      </div>
                      {item.lastOpened && (
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {formatLastOpened(item.lastOpened)}
                        </span>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>

          {/* Footer */}
          <div className="text-muted-foreground flex items-center justify-between border-t px-4 py-2 text-xs">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="bg-muted text-muted-foreground rounded px-1 py-0.5">
                  ↑↓
                </kbd>
                <span>Select</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="bg-muted text-muted-foreground rounded px-1 py-0.5">
                  ↵
                </kbd>
                <span>Switch</span>
              </span>
            </div>
            <span className="flex items-center gap-1">
              <kbd className="bg-muted text-muted-foreground rounded px-1 py-0.5">
                Esc
              </kbd>
              <span>Close</span>
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
