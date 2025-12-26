import { useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { Table, Code } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { TableView } from './TableView';
import { QueryEditor } from './QueryEditor';
import { Toolbar } from './Toolbar';
import { DiffPreview } from './DiffPreview';
import { ResizablePanel } from './ResizablePanel';
import { useConnectionStore, useChangesStore } from '@/stores';
import { cn } from '@/lib/utils';

type TabValue = 'data' | 'query';

export function DatabaseView() {
  const { selectedTable } = useConnectionStore();
  const { hasChanges } = useChangesStore();
  const [activeTab, setActiveTab] = useState<TabValue>('data');
  const [showChangesPanel, setShowChangesPanel] = useState(false);

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
          <Sidebar />
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
              className={cn(
                'flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                activeTab === 'data'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Table className="h-4 w-4" />
              Data Browser
            </Tabs.Trigger>
            <Tabs.Trigger
              value="query"
              className={cn(
                'flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                activeTab === 'query'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Code className="h-4 w-4" />
              SQL Query
            </Tabs.Trigger>
          </Tabs.List>

          {/* Tab Content */}
          <Tabs.Content
            value="data"
            className="h-full min-h-0 flex-1 data-[state=inactive]:hidden"
          >
            {selectedTable ? (
              <TableView />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
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
      </div>
    </div>
  );
}
