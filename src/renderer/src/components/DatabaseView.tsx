import type { SavedQuery } from '@shared/types';
import { ArrowLeftRight, Code, GitCompare, GitFork, Table } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ShortcutKbd } from '@/components/ui/kbd';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  useChangesStore,
  useConnectionStore,
  useDataTabsStore,
  useQueryStore,
  useQueryTabsStore,
  useSettingsStore,
} from '@/stores';
import { ConnectionTabBar } from './ConnectionTabBar';
import { DataDiffPanel } from './data-diff/DataDiffPanel';
import { DataTabBar } from './data-table';
import { DiffPreview } from './DiffPreview';
import { ERDiagram } from './er-diagram';
import { QueryEditor } from './QueryEditor';
import { ResizablePanel } from './ResizablePanel';
import { SchemaComparisonPanel } from './schema-comparison';
import { SchemaDetailsPanel } from './SchemaDetailsPanel';
import { Sidebar } from './Sidebar';
import { TableView } from './TableView';
import { Toolbar } from './Toolbar';

type TabValue = 'data' | 'query' | 'diagram' | 'compare' | 'dataDiff';

interface DatabaseViewProps {
  onOpenDatabase?: () => void;
  onOpenRecentConnection?: (
    path: string,
    isEncrypted: boolean,
    readOnly?: boolean
  ) => void;
}

export function DatabaseView({
  onOpenDatabase,
  onOpenRecentConnection,
}: DatabaseViewProps) {
  const { selectedTable, activeConnectionId, setSelectedTable } =
    useConnectionStore();
  const { hasChanges } = useChangesStore();
  const {
    getActiveTab,
    tabsByConnection,
    setActiveConnectionId: setDataTabsActiveConnection,
  } = useDataTabsStore();
  const { sidebarCollapsed, toggleSidebar } = useSettingsStore();
  const { setCurrentQuery } = useQueryStore();
  const { getActiveTab: getActiveQueryTab, updateTabQuery } =
    useQueryTabsStore();

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

  // Sync data tabs store with connection
  useEffect(() => {
    if (activeConnectionId) {
      setDataTabsActiveConnection(activeConnectionId);
    }
  }, [activeConnectionId, setDataTabsActiveConnection]);

  // When active data tab changes (user clicks a tab), sync the selected table for schema details panel
  const prevActiveDataTabIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeDataTab && activeDataTab.id !== prevActiveDataTabIdRef.current) {
      prevActiveDataTabIdRef.current = activeDataTab.id;
      // Update selectedTable to match the active tab (for schema panel)
      const activeTableKey = `${activeDataTab.table.schema || 'main'}.${activeDataTab.table.name}`;
      const selectedTableKey = selectedTable
        ? `${selectedTable.schema || 'main'}.${selectedTable.name}`
        : null;

      if (activeTableKey !== selectedTableKey) {
        setSelectedTable(activeDataTab.table);
      }
    }
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
          case '5':
            e.preventDefault();
            setActiveTab('compare');
            break;
          case '6':
            e.preventDefault();
            setActiveTab('dataDiff');
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
    // Also ensure sidebar is visible
    if (sidebarCollapsed) {
      toggleSidebar();
    }
  }, [sidebarCollapsed, toggleSidebar]);

  // Handler to load a favorite query from toolbar
  const handleLoadFavoriteQuery = useCallback(
    (query: SavedQuery) => {
      // Switch to query tab
      setActiveTab('query');
      // Load query into editor
      setCurrentQuery(query.queryText ?? '');
      // Update active tab query if in multi-tab mode
      if (activeConnectionId) {
        const activeQueryTab = getActiveQueryTab(activeConnectionId);
        if (activeQueryTab) {
          updateTabQuery(
            activeConnectionId,
            activeQueryTab.id,
            query.queryText ?? ''
          );
        }
      }
    },
    [activeConnectionId, getActiveQueryTab, setCurrentQuery, updateTabQuery]
  );

  return (
    <div className="flex h-full flex-col">
      {/* Hidden button for keyboard shortcut to toggle sidebar */}
      <button
        data-action="toggle-sidebar"
        onClick={toggleSidebar}
        className="sr-only"
        aria-label="Toggle Sidebar"
      />

      {/* Connection Tab Bar */}
      <ConnectionTabBar />

      {/* Toolbar */}
      <Toolbar
        onOpenChanges={() => setShowChangesPanel(true)}
        onLoadFavoriteQuery={handleLoadFavoriteQuery}
      />

      {/* Main Content */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Sidebar - Resizable */}
        {!sidebarCollapsed && (
          <ResizablePanel
            side="left"
            defaultWidth={256}
            minWidth={180}
            maxWidth={400}
            storageKey="sidebar"
          >
            <Sidebar
              onOpenDatabase={onOpenDatabase}
              onOpenRecentConnection={onOpenRecentConnection}
              onSwitchToQuery={() => setActiveTab('query')}
            />
          </ResizablePanel>
        )}

        {/* Content Area with Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => v && setActiveTab(v as TabValue)}
          className="flex min-w-0 flex-1 flex-col overflow-hidden"
        >
          {/* Tab List */}
          <TabsList variant="line" className="flex border-b px-2">
            <TabsTrigger
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
              <ShortcutKbd
                action="nav.data-browser"
                className="ml-1 hidden sm:inline-flex"
              />
            </TabsTrigger>
            <TabsTrigger
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
              <ShortcutKbd
                action="nav.query-editor"
                className="ml-1 hidden sm:inline-flex"
              />
            </TabsTrigger>
            <TabsTrigger
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
              <ShortcutKbd
                binding={{ key: '3', modifiers: { cmd: true } }}
                className="ml-1 hidden sm:inline-flex"
              />
            </TabsTrigger>
            <TabsTrigger
              value="compare"
              data-tab="compare"
              className={cn(
                'flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                activeTab === 'compare'
                  ? 'border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground border-transparent'
              )}
            >
              <GitCompare className="h-4 w-4" />
              Schema Compare
              <ShortcutKbd
                action="nav.schema-compare"
                className="ml-1 hidden sm:inline-flex"
              />
            </TabsTrigger>
            <TabsTrigger
              value="dataDiff"
              data-tab="dataDiff"
              className={cn(
                'flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                activeTab === 'dataDiff'
                  ? 'border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground border-transparent'
              )}
            >
              <ArrowLeftRight className="h-4 w-4" />
              Data Diff
              <ShortcutKbd
                binding={{ key: '6', modifiers: { cmd: true } }}
                className="ml-1 hidden sm:inline-flex"
              />
            </TabsTrigger>
          </TabsList>

          {/* Tab Content */}
          <TabsContent
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
                showDetailsPanel={showDetailsPanel}
                onDetailsToggle={setShowDetailsPanel}
              />
            ) : displayTable ? (
              <TableView
                showDetailsPanel={showDetailsPanel}
                onDetailsToggle={setShowDetailsPanel}
              />
            ) : (
              <div className="bg-grid-dot text-muted-foreground flex h-full items-center justify-center">
                <p>Select a table from the sidebar to view its data</p>
              </div>
            )}
          </TabsContent>

          <TabsContent
            value="query"
            className="h-full min-h-0 flex-1 data-[state=inactive]:hidden"
          >
            <QueryEditor />
          </TabsContent>

          <TabsContent
            value="diagram"
            className="h-full min-h-0 flex-1 data-[state=inactive]:hidden"
          >
            <ERDiagram />
          </TabsContent>

          <TabsContent
            value="compare"
            className="h-full min-h-0 flex-1 data-[state=inactive]:hidden"
          >
            <SchemaComparisonPanel />
          </TabsContent>

          <TabsContent
            value="dataDiff"
            className="h-full min-h-0 flex-1 data-[state=inactive]:hidden"
          >
            <DataDiffPanel />
          </TabsContent>
        </Tabs>

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
