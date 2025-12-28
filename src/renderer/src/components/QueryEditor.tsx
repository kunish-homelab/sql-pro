import {
  AlertCircle,
  Clock,
  Code,
  History,
  Loader2,
  Play,
  Search,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { ScrollArea } from '@/components/ui/scroll-area';
import { sqlPro } from '@/lib/api';
import { generateSuggestions } from '@/lib/query-plan-analyzer';
import { cn } from '@/lib/utils';
import { useConnectionStore, useQueryStore, useQueryTabsStore } from '@/stores';
import { QueryOptimizerPanel } from './data-tools/QueryOptimizerPanel';
import { MonacoSqlEditor } from './MonacoSqlEditor';
import { QueryPane } from './query-editor/QueryPane';
import { QueryTabBar } from './query-editor/QueryTabBar';
import { QueryTemplatesPicker } from './query-editor/QueryTemplatesPicker';
import { QueryResults } from './QueryResults';

/**
 * Formats duration in milliseconds to a readable string
 * @param ms - Duration in milliseconds
 * @returns Formatted string like '234ms' or '1.2s'
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

export function QueryEditor() {
  const { connection, schema } = useConnectionStore();
  const {
    currentQuery,
    results,
    error,
    isExecuting,
    executionTime,
    history,
    setCurrentQuery,
    setResults,
    setError,
    setIsExecuting,
    setExecutionTime,
    addToHistory,
    loadHistory,
    deleteHistoryItem,
    clearHistory,
  } = useQueryStore();

  // Multi-tab state
  const {
    activeTabId,
    setDbPath,
    getActiveTab,
    updateTabQuery,
    updateTabResults,
    updateTabError,
    setTabExecuting,
    splitLayout,
    activePaneId,
    setActivePaneId,
    closeSplit,
    isSplit,
  } = useQueryTabsStore();

  const [showHistory, setShowHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showOptimizer, setShowOptimizer] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Check if in split view mode
  const isSplitView = isSplit();

  // Get active tab state
  const activeTab = getActiveTab();
  const tabQuery = activeTab?.query ?? currentQuery;
  const tabResults = activeTab?.results ?? results;
  const tabError = activeTab?.error ?? error;
  const tabIsExecuting = activeTab?.isExecuting ?? isExecuting;
  const tabExecutionTime = activeTab?.executionTime ?? executionTime;

  // Initialize tabs when database changes
  useEffect(() => {
    if (connection?.path) {
      setDbPath(connection.path);
    }
  }, [connection?.path, setDbPath]);

  // Filter history based on search term (case-insensitive)
  const filteredHistory = useMemo(() => {
    if (!historySearch.trim()) {
      return history;
    }
    const searchLower = historySearch.toLowerCase();
    return history.filter((item) =>
      item.queryText.toLowerCase().includes(searchLower)
    );
  }, [history, historySearch]);

  // Load history when connection changes
  useEffect(() => {
    if (connection?.path) {
      loadHistory(connection.path);
    }
  }, [connection?.path, loadHistory]);

  // Keyboard shortcut for history toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'h') {
        e.preventDefault();
        setShowHistory((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleExecute = useCallback(async () => {
    if (!connection || !tabQuery.trim() || !activeTabId) return;

    setTabExecuting(activeTabId, true);
    setIsExecuting(true);
    setError(null);
    setResults(null);
    updateTabError(activeTabId, null);

    try {
      const result = await sqlPro.db.executeQuery({
        connectionId: connection.id,
        query: tabQuery.trim(),
      });

      if (result.success) {
        const queryResult = {
          columns: result.columns || [],
          rows: result.rows || [],
          rowsAffected: result.rowsAffected || 0,
          lastInsertRowId: result.lastInsertRowId,
        };
        setResults(queryResult);
        setExecutionTime(result.executionTime || 0);
        updateTabResults(activeTabId, queryResult, result.executionTime || 0);
        addToHistory(
          connection.path,
          tabQuery.trim(),
          true,
          result.executionTime || 0
        );
      } else {
        setError(result.error || 'Query failed');
        updateTabError(activeTabId, result.error || 'Query failed');
        addToHistory(connection.path, tabQuery.trim(), false, 0, result.error);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      updateTabError(activeTabId, errorMessage);
      addToHistory(connection.path, tabQuery.trim(), false, 0, errorMessage);
    } finally {
      setTabExecuting(activeTabId, false);
      setIsExecuting(false);
    }
  }, [
    connection,
    tabQuery,
    activeTabId,
    setTabExecuting,
    setIsExecuting,
    setError,
    setResults,
    updateTabError,
    setExecutionTime,
    updateTabResults,
    addToHistory,
  ]);

  const handleQueryChange = useCallback(
    (query: string) => {
      setCurrentQuery(query);
      if (activeTabId) {
        updateTabQuery(activeTabId, query);
      }
    },
    [activeTabId, setCurrentQuery, updateTabQuery]
  );

  const handleTemplateSelect = useCallback(
    (query: string) => {
      handleQueryChange(query);
    },
    [handleQueryChange]
  );

  const handleHistorySelect = (query: string) => {
    handleQueryChange(query);
    setShowHistory(false);
  };

  const handleHistoryDelete = (e: React.MouseEvent, entryId: string) => {
    e.stopPropagation();
    if (connection?.path) {
      deleteHistoryItem(connection.path, entryId);
    }
  };

  const handleClearAllHistory = () => {
    if (connection?.path) {
      clearHistory(connection.path);
      setShowClearConfirm(false);
    }
  };

  const handleAnalyze = useCallback(
    async (query: string) => {
      if (!connection) {
        throw new Error('No database connection');
      }

      const result = await sqlPro.db.analyzeQueryPlan({
        connectionId: connection.id,
        query: query.trim(),
      });

      if (!result.success || !result.plan || !result.stats) {
        throw new Error(result.error || 'Failed to analyze query');
      }

      const suggestions = generateSuggestions(result.plan, result.stats);

      return {
        plan: result.plan,
        stats: result.stats,
        suggestions,
      };
    },
    [connection]
  );

  return (
    <div ref={containerRef} className="relative flex h-full flex-col">
      {/* Tab Bar */}
      <QueryTabBar />

      {/* Editor Header */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <h2 className="font-medium">SQL Query</h2>
          <span className="text-muted-foreground text-xs">
            Cmd/Ctrl+Enter to execute
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTemplates(true)}
            className="gap-1"
          >
            <Code className="h-4 w-4" />
            Templates
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className="gap-1"
          >
            <History className="h-4 w-4" />
            History
            <kbd className="bg-muted text-muted-foreground ml-1 rounded px-1 py-0.5 font-mono text-[10px]">
              ⌘H
            </kbd>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowOptimizer(true)}
            disabled={!tabQuery.trim()}
            className="gap-1"
            title="Analyze query execution plan"
          >
            <Zap className="h-4 w-4" />
            Analyze
          </Button>
          <Button
            size="sm"
            onClick={handleExecute}
            disabled={tabIsExecuting || !tabQuery.trim()}
            className="gap-1"
          >
            {tabIsExecuting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Execute
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Split View Mode */}
        {isSplitView ? (
          <ResizablePanelGroup
            direction={splitLayout.direction as 'horizontal' | 'vertical'}
            className="h-full"
          >
            {splitLayout.panes.map((pane, index) => (
              <React.Fragment key={pane.id}>
                {index > 0 && <ResizableHandle withHandle />}
                <ResizablePanel defaultSize={50} minSize={20}>
                  <QueryPane
                    pane={pane}
                    connectionId={connection?.id || ''}
                    schema={schema}
                    isActive={pane.id === activePaneId}
                    onActivate={() => setActivePaneId(pane.id)}
                    onClose={index > 0 ? closeSplit : undefined}
                    showCloseButton={index > 0}
                  />
                </ResizablePanel>
              </React.Fragment>
            ))}
          </ResizablePanelGroup>
        ) : (
          /* Single Pane Mode */
          <>
            {/* Editor */}
            <div className="flex flex-1 flex-col">
              <div className="shrink-0 border-b">
                <MonacoSqlEditor
                  value={tabQuery}
                  onChange={handleQueryChange}
                  onExecute={handleExecute}
                  schema={schema}
                />
              </div>

              {/* Results Area */}
              <div className="flex-1 overflow-hidden">
                {tabIsExecuting ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
                  </div>
                ) : tabError ? (
                  <div className="flex h-full items-center justify-center p-4">
                    <div className="border-destructive/50 bg-destructive/10 flex max-w-md items-start gap-3 rounded-lg border p-4">
                      <AlertCircle className="text-destructive h-5 w-5 shrink-0" />
                      <div>
                        <p className="text-destructive font-medium">
                          Query Error
                        </p>
                        <p className="text-destructive/80 mt-1 text-sm">
                          {tabError}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : tabResults ? (
                  <div className="flex h-full flex-col">
                    {/* Results Header */}
                    <div className="text-muted-foreground flex items-center gap-4 border-b px-4 py-2 text-sm">
                      <span>{tabResults.rowsAffected} rows</span>
                      {tabExecutionTime !== null && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {tabExecutionTime.toFixed(2)}ms
                        </span>
                      )}
                      {tabResults.lastInsertRowId !== undefined && (
                        <span>
                          Last Insert ID: {tabResults.lastInsertRowId}
                        </span>
                      )}
                    </div>
                    {/* Results Table */}
                    <div className="flex-1 overflow-hidden">
                      <QueryResults results={tabResults} />
                    </div>
                  </div>
                ) : (
                  <div className="text-muted-foreground flex h-full items-center justify-center">
                    <p>Execute a query to see results</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* History Panel - rendered via Portal */}
        {showHistory &&
          containerRef.current &&
          createPortal(
            <div className="bg-background absolute top-0 right-0 bottom-0 flex w-96 flex-col border-l">
              <div className="flex shrink-0 items-center justify-between border-b px-4 py-2">
                <h3 className="font-medium">Query History</h3>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setShowClearConfirm(true)}
                    disabled={history.length === 0}
                    title="Clear all history"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setShowHistory(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {/* Search Input */}
              <div className="shrink-0 border-b px-3 py-2">
                <div className="relative">
                  <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
                  <Input
                    type="text"
                    placeholder="Search history..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="h-8 pl-8 text-sm"
                  />
                </div>
              </div>
              <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-1 p-2">
                  {filteredHistory.length === 0 ? (
                    <p className="text-muted-foreground py-8 text-center text-sm">
                      {historySearch.trim()
                        ? 'No matching queries'
                        : 'No queries yet'}
                    </p>
                  ) : (
                    filteredHistory.map((item) => (
                      <div
                        key={item.id}
                        className={cn(
                          'hover:bg-accent group relative w-full rounded-md px-3 py-2 text-left text-sm transition-colors',
                          !item.success && 'border-destructive border-l-2'
                        )}
                      >
                        <button
                          onClick={() => handleHistorySelect(item.queryText)}
                          className="w-full text-left"
                        >
                          <div className="flex items-center gap-2 pr-6">
                            {item.success ? (
                              <span className="text-xs text-green-600">
                                {formatDuration(item.durationMs)}
                              </span>
                            ) : (
                              <span className="text-destructive text-xs">
                                Failed
                              </span>
                            )}
                            <span className="text-muted-foreground text-xs">
                              {new Date(item.executedAt).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-3 pr-6 font-mono text-xs break-all">
                            {item.queryText}
                          </p>
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-1/2 right-1 h-6 w-6 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={(e) => handleHistoryDelete(e, item.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>,
            containerRef.current
          )}
      </div>

      {/* Clear All Confirmation Dialog */}
      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Query History</DialogTitle>
            <DialogDescription>
              Are you sure you want to clear all query history for this
              database? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowClearConfirm(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleClearAllHistory}>
              Clear All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Query Templates Picker */}
      <QueryTemplatesPicker
        open={showTemplates}
        onOpenChange={setShowTemplates}
        onSelect={handleTemplateSelect}
      />

      {/* Query Optimizer Panel */}
      <QueryOptimizerPanel
        open={showOptimizer}
        onOpenChange={setShowOptimizer}
        query={tabQuery}
        onAnalyze={handleAnalyze}
      />
    </div>
  );
}
