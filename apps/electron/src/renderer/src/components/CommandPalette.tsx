import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@sqlpro/ui/command';
import { Command as CommandIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  getFilteredCommands,
  useCommandPaletteStore,
  useUIFont,
} from '@/stores';

const categoryLabels: Record<string, string> = {
  navigation: 'Navigation',
  view: 'View',
  actions: 'Actions',
  settings: 'Settings',
  help: 'Help',
};

const categoryOrder = ['actions', 'navigation', 'view', 'settings', 'help'];

export function CommandPalette() {
  // Use individual selectors to prevent unnecessary re-renders
  const isOpen = useCommandPaletteStore((s) => s.isOpen);
  const search = useCommandPaletteStore((s) => s.search);
  const commands = useCommandPaletteStore((s) => s.commands);
  const close = useCommandPaletteStore((s) => s.close);
  const setSearch = useCommandPaletteStore((s) => s.setSearch);
  const executeCommand = useCommandPaletteStore((s) => s.executeCommand);

  // Get UI font settings
  const uiFont = useUIFont();

  // Memoize filtered commands to prevent recalculation on every render
  const filteredCommands = useMemo(
    () => getFilteredCommands(commands, search),
    [commands, search]
  );

  // Memoize grouped commands
  const groupedCommands = useMemo(() => {
    return filteredCommands.reduce(
      (acc, command) => {
        if (!acc[command.category]) {
          acc[command.category] = [];
        }
        acc[command.category].push(command);
        return acc;
      },
      {} as Record<string, typeof filteredCommands>
    );
  }, [filteredCommands]);

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
    }
  }, [isOpen, setSearch]);

  // Font style for dialog content
  const fontStyle = {
    fontFamily: uiFont.family
      ? `"${uiFont.family}", system-ui, sans-serif`
      : undefined,
    fontSize: `${uiFont.size}px`,
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="overflow-hidden p-0"
        style={fontStyle}
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Command Palette</DialogTitle>
        <Command
          className="**:[[cmdk-group-heading]]:text-muted-foreground **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group]]:px-2"
          shouldFilter={false}
        >
          <CommandInput
            placeholder="Search commands..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-75">
            <CommandEmpty>No commands found</CommandEmpty>
            {categoryOrder
              .filter((category) => groupedCommands[category]?.length > 0)
              .map((category) => (
                <CommandGroup
                  key={category}
                  heading={categoryLabels[category] || category}
                >
                  {groupedCommands[category].map((command) => (
                    <CommandItem
                      key={command.id}
                      value={command.id}
                      onSelect={() => executeCommand(command.id)}
                      className="gap-3"
                    >
                      {command.icon ? (
                        <command.icon className="text-muted-foreground h-4 w-4 shrink-0" />
                      ) : (
                        <CommandIcon className="text-muted-foreground h-4 w-4 shrink-0" />
                      )}
                      <span className="flex-1">{command.label}</span>
                      {command.shortcut && (
                        <CommandShortcut className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
                          {command.shortcut}
                        </CommandShortcut>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
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
                <span>Run</span>
              </span>
            </div>
            <span>{filteredCommands.length} commands</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
