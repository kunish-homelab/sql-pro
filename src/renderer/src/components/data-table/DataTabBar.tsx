import type { DataTab } from '@/stores';
import { Button } from '@sqlpro/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@sqlpro/ui/context-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@sqlpro/ui/tooltip';
import { Eye, Plus, Table, X } from 'lucide-react';
import { memo, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useConnectionStore, useDataTabsStore } from '@/stores';

/**
 * Hook for keyboard shortcuts to navigate between tabs
 * - Ctrl + Tab: Switch to next tab
 * - Ctrl + Shift + Tab: Switch to previous tab
 * - Cmd/Ctrl + 1-9: Switch to tab by index
 * - Cmd + W: Close current tab
 * - Cmd + Alt + T: Close other tabs
 */
function useTabKeyboardNavigation(
  tabs: DataTab[],
  activeTabId: string | null,
  connectionId: string | null,
  setActiveTab: (connectionId: string, tabId: string) => void,
  closeTab: (connectionId: string, tabId: string) => void,
  closeOtherTabs: (connectionId: string, tabId: string) => void
) {
  useEffect(() => {
    if (!connectionId || tabs.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + Tab / Ctrl + Shift + Tab: Navigate between tabs
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault();
        const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
        if (currentIndex === -1) return;

        let newIndex: number;
        if (e.shiftKey) {
          // Ctrl + Shift + Tab: Previous tab
          newIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
        } else {
          // Ctrl + Tab: Next tab
          newIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
        }

        setActiveTab(connectionId, tabs[newIndex].id);
        return;
      }

      const isMod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl + W: Close current tab
      if (isMod && (e.key === 'w' || e.code === 'KeyW') && activeTabId) {
        e.preventDefault();
        closeTab(connectionId, activeTabId);
        return;
      }

      // Cmd/Ctrl + Alt + T: Close other tabs
      // Use e.code because Alt+T produces special character on macOS
      if (
        isMod &&
        e.altKey &&
        e.code === 'KeyT' &&
        activeTabId &&
        tabs.length > 1
      ) {
        e.preventDefault();
        closeOtherTabs(connectionId, activeTabId);
        return;
      }

      // Cmd/Ctrl + 1-9: Switch to tab by index
      if (isMod && !e.altKey && e.key >= '1' && e.key <= '9') {
        const index = Number.parseInt(e.key, 10) - 1;
        if (index < tabs.length) {
          e.preventDefault();
          setActiveTab(connectionId, tabs[index].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tabs, activeTabId, connectionId, setActiveTab, closeTab, closeOtherTabs]);
}

interface DataTabBarProps {
  className?: string;
  onOpenSidebar?: () => void;
}

interface TabItemProps {
  tab: DataTab;
  isActive: boolean;
  connectionId: string;
  onSelect: () => void;
  onClose: () => void;
  onCloseOthers: () => void;
  tabsCount: number;
}

const TabItem = memo(
  ({
    tab,
    isActive,
    connectionId: _connectionId,
    onSelect,
    onClose,
    onCloseOthers,
    tabsCount,
  }: TabItemProps) => {
    const handleCloseClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onClose();
      },
      [onClose]
    );

    const isView = tab.table.type === 'view';

    return (
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            role="tab"
            aria-selected={isActive}
            className={cn(
              'group relative flex h-8 max-w-45 min-w-25 cursor-pointer items-center gap-1.5 border-r px-2.5 text-sm transition-colors',
              isActive
                ? 'bg-background text-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
            onClick={onSelect}
          >
            {isView ? (
              <Eye className="h-3.5 w-3.5 shrink-0 opacity-60" />
            ) : (
              <Table className="h-3.5 w-3.5 shrink-0 opacity-60" />
            )}
            <span className="flex-1 truncate" title={tab.table.name}>
              {tab.title}
            </span>
            {tab.table.schema && tab.table.schema !== 'main' && (
              <span className="text-muted-foreground shrink-0 text-[10px]">
                {tab.table.schema}
              </span>
            )}
            <TooltipProvider delay={300}>
              <Tooltip>
                <TooltipTrigger>
                  <button
                    onClick={handleCloseClick}
                    className={cn(
                      'hover:bg-accent shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100',
                      isActive && 'opacity-60'
                    )}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Close tab
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={onClose}>Close</ContextMenuItem>
          <ContextMenuItem onClick={onCloseOthers} disabled={tabsCount <= 1}>
            Close Others
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => {
              // Copy table name to clipboard
              navigator.clipboard.writeText(tab.table.name);
            }}
          >
            Copy Table Name
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  }
);

TabItem.displayName = 'DataTabItem';

export const DataTabBar = memo(
  ({ className, onOpenSidebar }: DataTabBarProps) => {
    const { activeConnectionId } = useConnectionStore();
    const { tabsByConnection, closeTab, closeOtherTabs, setActiveTab } =
      useDataTabsStore();

    // Get tabs for current connection
    const connectionTabState = activeConnectionId
      ? tabsByConnection[activeConnectionId]
      : null;
    const tabs = connectionTabState?.tabs || [];
    const activeTabId = connectionTabState?.activeTabId || null;

    // Enable keyboard navigation between tabs
    useTabKeyboardNavigation(
      tabs,
      activeTabId,
      activeConnectionId,
      setActiveTab,
      closeTab,
      closeOtherTabs
    );

    if (!activeConnectionId || tabs.length === 0) {
      return null;
    }

    return (
      <div
        className={cn('bg-muted/30 flex h-8 items-center border-b', className)}
        role="tablist"
      >
        <div className="flex flex-1 items-center overflow-x-auto">
          {tabs.map((tab) => (
            <TabItem
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeTabId}
              connectionId={activeConnectionId}
              onSelect={() => setActiveTab(activeConnectionId, tab.id)}
              onClose={() => closeTab(activeConnectionId, tab.id)}
              onCloseOthers={() => closeOtherTabs(activeConnectionId, tab.id)}
              tabsCount={tabs.length}
            />
          ))}
        </div>
        {onOpenSidebar && (
          <div className="flex items-center border-l">
            <TooltipProvider delay={300}>
              <Tooltip>
                <TooltipTrigger>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={onOpenSidebar}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Open table from sidebar
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>
    );
  }
);

DataTabBar.displayName = 'DataTabBar';
