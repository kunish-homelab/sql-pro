import * as Tabs from '@radix-ui/react-tabs';
import { Code, GitFork, Info, Table } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  useChangesStore,
  useConnectionStore,
  useDataTabsStore,
} from '@/stores';
import { DataTabBar } from './data-table';
import { DiffPreview } from './DiffPreview';
import { ERDiagram } from './er-diagram';
import { QueryEditor } from './QueryEditor';
import { ResizablePanel } from './ResizablePanel';
import { SchemaDetailsPanel } from './SchemaDetailsPanel';
import { Sidebar } from './Sidebar';
import { TableView } from './TableView';
import { Toolbar } from './Toolbar';

type TabValue = 'data' | 'query' | 'diagram';

interface DatabaseViewProps {
  onOpenDatabase?: () => void;
}

export function DatabaseView({ onOpenDatabase }: DatabaseViewProps) {
  const { selectedTable, activeConnectionId, setSelectedTable } =
    useConnectionStore();
  const { hasChanges } = useChangesStore();
  const {
    openTable,
    getActiveTab,
    tabsByConnection,
    setActiveConnectionId: setDataTabsActiveConnection,
  } = useDataTabsStore();

  const [activeTab, setActiveTab] = useState<TabValue>('data');
  const [showChangesPanel, setShowChangesPanel] = useState(false);
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);

  // Get the active data tab for current connection
  const activeDataTab = activeConnectionId
    ? getActiveTab(activeConnectionId)
    : undefined;
  const dataTabs = activeConnectionId
    ? tabsByConnection[activeConnectionId]?.tabs || []
    : [];

  // Track last opened table to prevent infinite loops
  const lastOpenedTableRef = useRef<string | null>(null);
  const isUpdatingFromTabRef = useRef(false);

  // Sync data tabs store with connection
  useEffect(() => {
    if (activeConnectionId) {
      setDataTabsActiveConnection(activeConnectionId);
    }
  }, [activeConnectionId, setDataTabsActiveConnection]);

  // When a table is selected from the sidebar, open it in a new tab
  useEffect(() => {
    if (selectedTable && activeConnectionId && !isUpdatingFromTabRef.current) {
      const tableKey = `${selectedTable.schema || 'main'}.${selectedTable.name}`;
      // Only open if this is a different table than we last opened
      if (lastOpenedTableRef.current !== tableKey) {
        lastOpenedTableRef.current = tableKey;
        openTable(activeConnectionId, selectedTable);
      }
    }
  }, [selectedTable, activeConnectionId, openTable]);

  // When active data tab changes, update selected table for schema details
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    if (activeDataTab) {
      const activeTableKey = `${activeDataTab.table.schema || 'main'}.${activeDataTab.table.name}`;
      const selectedTableKey = selectedTable
        ? `${selectedTable.schema || 'main'}.${selectedTable.name}`
        : null;

      if (activeTableKey !== selectedTableKey) {
        isUpdatingFromTabRef.current = true;
        lastOpenedTableRef.current = activeTableKey;
        setSelectedTable(activeDataTab.table);
        // Reset the flag after the state update
        timeoutId = setTimeout(() => {
          isUpdatingFromTabRef.current = false;
        }, 0);
      }
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [activeDataTab, selectedTable, setSelectedTable]);

  // The table to display - from active data tab or selected table
  const displayTable = activeDataTab?.table || selectedTable;

  // Keyboard shortcuts for tab switching
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            setActiveTab('data');
            break;
          case '2':
            e.preventDefault();
            setActiveTab('query');
            break;
          case '3':
            e.preventDefault();
            setActiveTab('diagram');
            break;
          case '4':
            e.preventDefault();
            setShowDetailsPanel((prev) => !prev);
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handler to scroll sidebar into view (used by DataTabBar's + button)
  const handleOpenSidebar = useCallback(() => {
    // Focus the sidebar search or just ensure data tab is active
    setActiveTab('data');
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <Toolbar onOpenChanges={() => setShowChangesPanel(true)} />

      {/* Main Content */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Sidebar - Resizable */}
        <ResizablePanel
          side="left"
          defaultWidth={256}
          minWidth={180}
          maxWidth={400}
          storageKey="sidebar"
        >
          <Sidebar onOpenDatabase={onOpenDatabase} />
        </ResizablePanel>

        {/* Content Area with Tabs */}
        <Tabs.Root
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabValue)}
          className="flex min-w-0 flex-1 flex-col overflow-hidden"
        >
          {/* Tab List */}
          <Tabs.List className="flex border-b px-2">
            <Tabs.Trigger
              value="data"
              data-tab="data"
              className={cn(
                'flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                activeTab === 'data'
                  ? 'border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground border-transparent'
              )}
            >
              <Table className="h-4 w-4" />
              Data Browser
              {dataTabs.length > 0 && (
                <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-normal">
                  {dataTabs.length}
                </span>
              )}
              <kbd className="bg-muted text-muted-foreground ml-1 hidden rounded px-1 py-0.5 font-mono text-[10px] sm:inline-block">
                ⌘1
              </kbd>
            </Tabs.Trigger>
            <Tabs.Trigger
              value="query"
              data-tab="query"
              className={cn(
                'flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                activeTab === 'query'
                  ? 'border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground border-transparent'
              )}
            >
              <Code className="h-4 w-4" />
              SQL Query
              <kbd className="bg-muted text-muted-foreground ml-1 hidden rounded px-1 py-0.5 font-mono text-[10px] sm:inline-block">
                ⌘2
              </kbd>
            </Tabs.Trigger>
            <Tabs.Trigger
              value="diagram"
              data-tab="diagram"
              className={cn(
                'flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                activeTab === 'diagram'
                  ? 'border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground border-transparent'
              )}
            >
              <GitFork className="h-4 w-4" />
              ER Diagram
              <kbd className="bg-muted text-muted-foreground ml-1 hidden rounded px-1 py-0.5 font-mono text-[10px] sm:inline-block">
                ⌘3
              </kbd>
            </Tabs.Trigger>

            {/* Schema Details Toggle */}
            <div className="ml-auto flex items-center px-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={showDetailsPanel ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setShowDetailsPanel((prev) => !prev)}
                    disabled={!displayTable}
                    className="gap-1.5"
                  >
                    <Info className="h-4 w-4" />
                    <span className="hidden sm:inline">Schema</span>
                    <kbd className="bg-muted text-muted-foreground hidden rounded px-1 py-0.5 font-mono text-[10px] sm:inline-block">
                      ⌘4
                    </kbd>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {displayTable
                    ? 'View schema details'
                    : 'Select a table to view schema details'}
                </TooltipContent>
              </Tooltip>
            </div>
          </Tabs.List>

          {/* Tab Content */}
          <Tabs.Content
            value="data"
            className="flex h-full min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
          >
            {/* Data Browser Tab Bar - shows opened table tabs */}
            {dataTabs.length > 0 && (
              <DataTabBar onOpenSidebar={handleOpenSidebar} />
            )}

            {/* Table View */}
            {activeDataTab ? (
              <TableView
                key={activeDataTab.id}
                tableOverride={activeDataTab.table}
              />
            ) : displayTable ? (
              <TableView />
            ) : (
              <div className="bg-grid-dot text-muted-foreground flex h-full items-center justify-center">
                <p>Select a table from the sidebar to view its data</p>
              </div>
            )}
          </Tabs.Content>

          <Tabs.Content
            value="query"
            className="h-full min-h-0 flex-1 data-[state=inactive]:hidden"
          >
            <QueryEditor />
          </Tabs.Content>

          <Tabs.Content
            value="diagram"
            className="h-full min-h-0 flex-1 data-[state=inactive]:hidden"
          >
            <ERDiagram />
          </Tabs.Content>
        </Tabs.Root>

        {/* Changes Panel - Resizable */}
        {showChangesPanel && hasChanges() && (
          <ResizablePanel
            side="right"
            defaultWidth={384}
            minWidth={280}
            maxWidth={600}
            storageKey="changes-panel"
          >
            <DiffPreview onClose={() => setShowChangesPanel(false)} />
          </ResizablePanel>
        )}

        {/* Schema Details Panel - Resizable */}
        {showDetailsPanel && (
          <ResizablePanel
            side="right"
            defaultWidth={360}
            minWidth={280}
            maxWidth={500}
            storageKey="schema-details-panel"
          >
            <SchemaDetailsPanel
              table={displayTable}
              onClose={() => setShowDetailsPanel(false)}
            />
          </ResizablePanel>
        )}
      </div>
    </div>
  );
}
