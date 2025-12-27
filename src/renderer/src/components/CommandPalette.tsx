import { Command as CommandIcon, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  getFilteredCommands,
  useCommandPaletteStore,
  useUIFont,
} from '@/stores';

export function CommandPalette() {
  // Use individual selectors to prevent unnecessary re-renders
  const isOpen = useCommandPaletteStore((s) => s.isOpen);
  const search = useCommandPaletteStore((s) => s.search);
  const selectedIndex = useCommandPaletteStore((s) => s.selectedIndex);
  const commands = useCommandPaletteStore((s) => s.commands);
  const close = useCommandPaletteStore((s) => s.close);
  const setSearch = useCommandPaletteStore((s) => s.setSearch);
  const setSelectedIndex = useCommandPaletteStore((s) => s.setSelectedIndex);
  const executeSelected = useCommandPaletteStore((s) => s.executeSelected);
  const moveSelection = useCommandPaletteStore((s) => s.moveSelection);
  const executeCommand = useCommandPaletteStore((s) => s.executeCommand);

  // Get UI font settings for portal content
  const uiFont = useUIFont();

  // Memoize filtered commands to prevent recalculation on every render
  const filteredCommands = useMemo(
    () => getFilteredCommands(commands, search),
    [commands, search]
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedElement = listRef.current.querySelector(
      `[data-index="${selectedIndex}"]`
    );
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Close on escape or click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          moveSelection('down');
          break;
        case 'ArrowUp':
          e.preventDefault();
          moveSelection('up');
          break;
        case 'Enter':
          e.preventDefault();
          executeSelected();
          break;
        case 'j':
          if (e.ctrlKey) {
            e.preventDefault();
            moveSelection('down');
          }
          break;
        case 'k':
          if (e.ctrlKey) {
            e.preventDefault();
            moveSelection('up');
          }
          break;
      }
    },
    [moveSelection, executeSelected]
  );

  // Memoize grouped commands
  const { groupedCommands, commandsWithIndex } = useMemo(() => {
    const grouped = filteredCommands.reduce(
      (acc, command) => {
        if (!acc[command.category]) {
          acc[command.category] = [];
        }
        acc[command.category].push(command);
        return acc;
      },
      {} as Record<string, typeof filteredCommands>
    );

    const categoryOrder = ['actions', 'navigation', 'view', 'settings', 'help'];
    let globalIndex = 0;
    const withIndex = categoryOrder
      .filter((cat) => grouped[cat])
      .flatMap((category) =>
        grouped[category].map((command) => ({
          command,
          category,
          index: globalIndex++,
        }))
      );

    return { groupedCommands: grouped, commandsWithIndex: withIndex };
  }, [filteredCommands]);

  const categoryLabels: Record<string, string> = {
    navigation: 'Navigation',
    view: 'View',
    actions: 'Actions',
    settings: 'Settings',
    help: 'Help',
  };

  const categoryOrder = ['actions', 'navigation', 'view', 'settings', 'help'];

  if (!isOpen) return null;

  // Font style for portal content
  const fontStyle = {
    fontFamily: uiFont.family
      ? `"${uiFont.family}", system-ui, sans-serif`
      : undefined,
    fontSize: `${uiFont.size}px`,
  };

  return createPortal(
    <div style={fontStyle} className="text-foreground">
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={close}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
        <div
          className="bg-background pointer-events-auto w-full max-w-lg rounded-xl border shadow-2xl"
          onKeyDown={handleKeyDown}
        >
          {/* Search Input */}
          <div className="flex items-center border-b px-4">
            <Search className="text-muted-foreground h-4 w-4 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search commands..."
              className="placeholder:text-muted-foreground h-12 flex-1 bg-transparent px-3 text-sm outline-none"
            />
            <kbd className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-xs">
              ESC
            </kbd>
          </div>

          {/* Commands List */}
          <ScrollArea className="h-[300px]">
            <div ref={listRef} className="p-2">
              {filteredCommands.length === 0 ? (
                <div className="text-muted-foreground py-8 text-center text-sm">
                  No commands found
                </div>
              ) : (
                categoryOrder
                  .filter((cat) => groupedCommands[cat])
                  .map((category) => (
                    <div key={category} className="mb-2 last:mb-0">
                      <div className="text-muted-foreground px-2 py-1.5 text-xs font-medium">
                        {categoryLabels[category] || category}
                      </div>
                      {commandsWithIndex
                        .filter((item) => item.category === category)
                        .map(({ command, index }) => (
                          <button
                            key={command.id}
                            data-index={index}
                            onClick={() => executeCommand(command.id)}
                            onMouseEnter={() => setSelectedIndex(index)}
                            className={cn(
                              'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                              selectedIndex === index
                                ? 'bg-accent text-accent-foreground'
                                : 'text-foreground hover:bg-accent/50'
                            )}
                          >
                            {command.icon ? (
                              <command.icon className="text-muted-foreground h-4 w-4 shrink-0" />
                            ) : (
                              <CommandIcon className="text-muted-foreground h-4 w-4 shrink-0" />
                            )}
                            <span className="flex-1 text-left">
                              {command.label}
                            </span>
                            {command.shortcut && (
                              <kbd className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-xs">
                                {command.shortcut}
                              </kbd>
                            )}
                          </button>
                        ))}
                    </div>
                  ))
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="text-muted-foreground flex items-center justify-between border-t px-4 py-2 text-xs">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="bg-muted rounded px-1 py-0.5">↑↓</kbd>
                <span>Select</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="bg-muted rounded px-1 py-0.5">↵</kbd>
                <span>Run</span>
              </span>
            </div>
            <span>{filteredCommands.length} commands</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
