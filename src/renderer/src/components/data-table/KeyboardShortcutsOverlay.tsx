import {
  ArrowUp,
  Command,
  CornerDownLeft,
  Keyboard,
  Search,
  X,
} from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface ShortcutItem {
  keys: string[];
  description: string;
  category: 'navigation' | 'editing' | 'search' | 'general';
}

const shortcuts: ShortcutItem[] = [
  // Navigation
  { keys: ['↑', '↓'], description: 'Navigate rows', category: 'navigation' },
  { keys: ['←', '→'], description: 'Navigate columns', category: 'navigation' },
  {
    keys: ['⌘', '↑'],
    description: 'Jump to first row',
    category: 'navigation',
  },
  { keys: ['⌘', '↓'], description: 'Jump to last row', category: 'navigation' },
  { keys: ['Tab'], description: 'Next cell', category: 'navigation' },
  { keys: ['⇧', 'Tab'], description: 'Previous cell', category: 'navigation' },
  { keys: ['Page↑'], description: 'Previous page', category: 'navigation' },
  { keys: ['Page↓'], description: 'Next page', category: 'navigation' },

  // Editing
  { keys: ['Enter'], description: 'Edit cell', category: 'editing' },
  { keys: ['Escape'], description: 'Cancel edit', category: 'editing' },
  { keys: ['⌘', 'S'], description: 'Save changes', category: 'editing' },
  { keys: ['⌘', 'Z'], description: 'Undo change', category: 'editing' },
  { keys: ['Delete'], description: 'Delete row', category: 'editing' },
  { keys: ['⌘', 'N'], description: 'New row', category: 'editing' },

  // Search & Filter
  { keys: ['⌘', 'F'], description: 'Search in table', category: 'search' },
  { keys: ['⌘', 'G'], description: 'Find next', category: 'search' },
  { keys: ['⇧', '⌘', 'G'], description: 'Find previous', category: 'search' },

  // General
  { keys: ['⌘', 'K'], description: 'Command palette', category: 'general' },
  { keys: ['⌘', 'R'], description: 'Refresh data', category: 'general' },
  { keys: ['⌘', 'E'], description: 'Export data', category: 'general' },
  { keys: ['?'], description: 'Show shortcuts', category: 'general' },
];

interface KeyboardShortcutsOverlayProps {
  className?: string;
}

/**
 * A floating button that shows keyboard shortcuts on hover/click
 */
export const KeyboardShortcutsOverlay = memo(
  ({ className }: KeyboardShortcutsOverlayProps) => {
    const [isOpen, setIsOpen] = useState(false);

    // Listen for ? key to toggle shortcuts
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        // Don't trigger if typing in an input
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        ) {
          return;
        }

        if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          setIsOpen((prev) => !prev);
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Group shortcuts by category
    const groupedShortcuts = shortcuts.reduce(
      (acc, shortcut) => {
        if (!acc[shortcut.category]) {
          acc[shortcut.category] = [];
        }
        acc[shortcut.category].push(shortcut);
        return acc;
      },
      {} as Record<string, ShortcutItem[]>
    );

    const categoryLabels: Record<string, string> = {
      navigation: 'Navigation',
      editing: 'Editing',
      search: 'Search & Filter',
      general: 'General',
    };

    const categoryIcons: Record<string, React.ReactNode> = {
      navigation: <ArrowUp className="h-3 w-3" />,
      editing: <CornerDownLeft className="h-3 w-3" />,
      search: <Search className="h-3 w-3" />,
      general: <Command className="h-3 w-3" />,
    };

    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger
          className={cn(
            'fixed right-4 bottom-4 z-50 rounded-full shadow-lg',
            'bg-background/80 border backdrop-blur-sm',
            'hover:bg-muted transition-all duration-200 hover:scale-105',
            'opacity-50 hover:opacity-100',
            'flex h-8 w-8 items-center justify-center',
            className
          )}
          title="Keyboard shortcuts (?)"
        >
          <Keyboard className="h-4 w-4" />
        </PopoverTrigger>
        <PopoverContent
          className="w-80 p-0"
          side="top"
          align="end"
          sideOffset={8}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b px-3 py-2">
            <div className="flex items-center gap-2">
              <Keyboard className="text-primary h-4 w-4" />
              <span className="text-sm font-medium">Keyboard Shortcuts</span>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>

          {/* Content */}
          <div className="max-h-[400px] overflow-y-auto">
            {Object.entries(groupedShortcuts).map(([category, items]) => (
              <div key={category} className="border-b last:border-b-0">
                {/* Category header */}
                <div className="bg-muted/50 flex items-center gap-1.5 px-3 py-1.5">
                  {categoryIcons[category]}
                  <span className="text-muted-foreground text-[10px] font-medium uppercase">
                    {categoryLabels[category]}
                  </span>
                </div>
                {/* Shortcuts list */}
                <div className="divide-border/50 divide-y">
                  {items.map((shortcut) => (
                    <div
                      key={shortcut.description}
                      className="hover:bg-muted/30 flex items-center justify-between px-3 py-1.5 transition-colors"
                    >
                      <span className="text-muted-foreground text-xs">
                        {shortcut.description}
                      </span>
                      <div className="flex items-center gap-0.5">
                        {shortcut.keys.map((key) => (
                          <kbd
                            key={key}
                            className={cn(
                              'rounded px-1.5 py-0.5 font-mono text-[10px]',
                              'bg-muted border shadow-sm',
                              'min-w-[20px] text-center'
                            )}
                          >
                            {key}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="bg-muted/30 border-t px-3 py-2">
            <p className="text-muted-foreground text-center text-[10px]">
              Press{' '}
              <kbd className="bg-muted rounded border px-1 py-0.5 text-[10px]">
                ?
              </kbd>{' '}
              to toggle this panel
            </p>
          </div>
        </PopoverContent>
      </Popover>
    );
  }
);

KeyboardShortcutsOverlay.displayName = 'KeyboardShortcutsOverlay';

interface InlineShortcutHintProps {
  keys: string[];
  className?: string;
}

/**
 * Small inline keyboard shortcut hint
 */
export const InlineShortcutHint = memo(
  ({ keys, className }: InlineShortcutHintProps) => {
    return (
      <span className={cn('inline-flex items-center gap-0.5', className)}>
        {keys.map((key) => (
          <kbd
            key={key}
            className={cn(
              'rounded px-1 py-0.5 font-mono text-[9px]',
              'bg-muted/50 text-muted-foreground',
              'min-w-[14px] text-center'
            )}
          >
            {key}
          </kbd>
        ))}
      </span>
    );
  }
);

InlineShortcutHint.displayName = 'InlineShortcutHint';
