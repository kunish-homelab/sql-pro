import type { QueryTab } from '@/stores';
import { Button } from '@sqlpro/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@sqlpro/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@sqlpro/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@sqlpro/ui/tooltip';
import { Columns2, Copy, FileCode, Plus, Rows2, X } from 'lucide-react';
import { memo, useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useConnectionStore, useQueryTabsStore } from '@/stores';

interface QueryTabBarProps {
  className?: string;
}

interface TabItemProps {
  tab: QueryTab;
  isActive: boolean;
  connectionId: string;
  onSelect: () => void;
  onClose: () => void;
  onDuplicate: () => void;
  onCloseOthers: () => void;
  onRename: () => void;
  tabsCount: number;
}

const TabItem = memo(
  ({
    tab,
    isActive,
    connectionId,
    onSelect,
    onClose,
    onDuplicate,
    onCloseOthers,
    onRename,
    tabsCount,
  }: TabItemProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(tab.title);
    const inputRef = useRef<HTMLInputElement>(null);
    const { updateTabTitle } = useQueryTabsStore();

    const handleStartEdit = useCallback(() => {
      setEditValue(tab.title);
      setIsEditing(true);
      setTimeout(() => inputRef.current?.select(), 0);
    }, [tab.title]);

    const handleFinishEdit = useCallback(() => {
      const trimmed = editValue.trim();
      if (trimmed && trimmed !== tab.title) {
        updateTabTitle(connectionId, tab.id, trimmed);
      }
      setIsEditing(false);
    }, [editValue, connectionId, tab.id, tab.title, updateTabTitle]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
          handleFinishEdit();
        } else if (e.key === 'Escape') {
          setEditValue(tab.title);
          setIsEditing(false);
        }
      },
      [handleFinishEdit, tab.title]
    );

    const handleCloseClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onClose();
      },
      [onClose]
    );

    const handleDoubleClick = useCallback(() => {
      handleStartEdit();
    }, [handleStartEdit]);

    return (
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            role="tab"
            aria-selected={isActive}
            className={cn(
              'group relative flex h-8 max-w-45 min-w-25 cursor-pointer items-center gap-1 border-r px-2 text-sm transition-colors',
              isActive
                ? 'bg-background text-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
            onClick={onSelect}
            onDoubleClick={handleDoubleClick}
          >
            <FileCode className="h-3.5 w-3.5 shrink-0 opacity-60" />
            {isEditing ? (
              <input
                ref={inputRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleFinishEdit}
                onKeyDown={handleKeyDown}
                className="bg-background h-5 flex-1 rounded border px-1 text-xs outline-none"
                autoFocus
              />
            ) : (
              <span className="flex-1 truncate">{tab.title}</span>
            )}
            {tab.isDirty && (
              <span className="text-primary h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
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
          <ContextMenuItem onClick={onRename}>Rename</ContextMenuItem>
          <ContextMenuItem onClick={onDuplicate}>
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={onClose}>Close</ContextMenuItem>
          <ContextMenuItem onClick={onCloseOthers} disabled={tabsCount <= 1}>
            Close Others
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  }
);

export const QueryTabBar = memo(({ className }: QueryTabBarProps) => {
  const { activeConnectionId } = useConnectionStore();
  const {
    tabsByConnection,
    createTab,
    closeTab,
    closeOtherTabs,
    setActiveTab,
    duplicateTab,
    splitPane,
    closeSplit,
    isSplit,
  } = useQueryTabsStore();

  // Get tabs for current connection
  const connectionTabState = activeConnectionId
    ? tabsByConnection[activeConnectionId]
    : null;
  const tabs = connectionTabState?.tabs || [];
  const activeTabId = connectionTabState?.activeTabId || null;

  const handleCreateTab = useCallback(() => {
    if (activeConnectionId) {
      createTab(activeConnectionId);
    }
  }, [activeConnectionId, createTab]);

  const handleSplitHorizontal = useCallback(() => {
    if (activeConnectionId) {
      splitPane(activeConnectionId, 'horizontal');
    }
  }, [activeConnectionId, splitPane]);

  const handleSplitVertical = useCallback(() => {
    if (activeConnectionId) {
      splitPane(activeConnectionId, 'vertical');
    }
  }, [activeConnectionId, splitPane]);

  const handleCloseSplit = useCallback(() => {
    if (activeConnectionId) {
      closeSplit(activeConnectionId);
    }
  }, [activeConnectionId, closeSplit]);

  const isSplitView = activeConnectionId ? isSplit(activeConnectionId) : false;

  if (!activeConnectionId) {
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
            onDuplicate={() => duplicateTab(activeConnectionId, tab.id)}
            onCloseOthers={() => closeOtherTabs(activeConnectionId, tab.id)}
            onRename={() => {}}
            tabsCount={tabs.length}
          />
        ))}
      </div>
      <div className="flex items-center border-l">
        <TooltipProvider delay={300}>
          <Tooltip>
            <TooltipTrigger>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={handleCreateTab}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              New query tab
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Split View Controls */}
        {isSplitView ? (
          <TooltipProvider delay={300}>
            <Tooltip>
              <TooltipTrigger>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={handleCloseSplit}
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Close split view
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <DropdownMenu>
            <TooltipProvider delay={300}>
              <Tooltip>
                <TooltipTrigger>
                  <DropdownMenuTrigger>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                    >
                      <Columns2 className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Split editor
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleSplitHorizontal}>
                <Columns2 className="mr-2 h-4 w-4" />
                Split Right
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSplitVertical}>
                <Rows2 className="mr-2 h-4 w-4" />
                Split Down
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
});
