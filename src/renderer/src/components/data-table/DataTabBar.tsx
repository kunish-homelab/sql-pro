import type { DataTab } from '@/stores';
import { Eye, Plus, Table, X } from 'lucide-react';
import { memo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useConnectionStore, useDataTabsStore } from '@/stores';

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
