import type { SplitPane } from '@/stores';
import type { DatabaseSchema } from '@/types/database';
import { AlertCircle, Clock, Loader2, Play, X, Zap } from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { sqlPro } from '@/lib/api';
import { generateSuggestions } from '@/lib/query-plan-analyzer';
import { cn } from '@/lib/utils';
import { useQueryTabsStore } from '@/stores';
import { QueryOptimizerPanel } from '../data-tools/QueryOptimizerPanel';
import { MonacoSqlEditor } from '../MonacoSqlEditor';
import { QueryResults } from '../QueryResults';

interface QueryPaneProps {
  pane: SplitPane;
  connectionId: string;
  schema: DatabaseSchema | null;
  isActive: boolean;
  onActivate: () => void;
  onClose?: () => void;
  showCloseButton?: boolean;
}

export const QueryPane = memo(
  ({
    pane,
    connectionId,
    schema,
    isActive,
    onActivate,
    onClose,
    showCloseButton = false,
  }: QueryPaneProps) => {
    const {
      tabs,
      updateTabQuery,
      updateTabResults,
      updateTabError,
      setTabExecuting,
      setPaneActiveTab,
    } = useQueryTabsStore();

    const [showOptimizer, setShowOptimizer] = useState(false);

    // Get the tab for this pane
    const tab = tabs.find((t) => t.id === pane.activeTabId);

    const handleQueryChange = useCallback(
      (query: string) => {
        if (tab) {
          updateTabQuery(tab.id, query);
        }
      },
      [tab, updateTabQuery]
    );

    const handleExecute = useCallback(async () => {
      if (!tab || !tab.query.trim()) return;

      setTabExecuting(tab.id, true);
      updateTabError(tab.id, null);

      try {
        const result = await sqlPro.db.executeQuery({
          connectionId,
          query: tab.query.trim(),
        });

        if (result.success) {
          const queryResult = {
            columns: result.columns || [],
            rows: result.rows || [],
            rowsAffected: result.rowsAffected || 0,
            lastInsertRowId: result.lastInsertRowId,
          };
          updateTabResults(tab.id, queryResult, result.executionTime || 0);
        } else {
          updateTabError(tab.id, result.error || 'Query failed');
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error';
        updateTabError(tab.id, errorMessage);
      } finally {
        setTabExecuting(tab.id, false);
      }
    }, [tab, connectionId, setTabExecuting, updateTabError, updateTabResults]);

    const handleAnalyze = useCallback(
      async (query: string) => {
        const result = await sqlPro.db.analyzeQueryPlan({
          connectionId,
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
      [connectionId]
    );

    const handleTabSelect = useCallback(
      (tabId: string) => {
        setPaneActiveTab(pane.id, tabId);
      },
      [pane.id, setPaneActiveTab]
    );

    if (!tab) {
      return (
        <div className="text-muted-foreground flex h-full items-center justify-center">
          <p>No query tab selected</p>
        </div>
      );
    }

    return (
      <div
        className={cn(
          'flex h-full flex-col',
          isActive && 'ring-primary/50 ring-2 ring-inset'
        )}
        onClick={onActivate}
      >
        {/* Pane Header with Tab Selector */}
        <div className="bg-muted/30 flex items-center justify-between border-b px-2 py-1">
          <div className="flex items-center gap-2">
            <select
              value={tab.id}
              onChange={(e) => handleTabSelect(e.target.value)}
              className="bg-background h-7 rounded border px-2 text-sm"
            >
              {tabs.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2"
              onClick={() => setShowOptimizer(true)}
              disabled={!tab.query.trim()}
              title="Analyze query"
            >
              <Zap className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              className="h-7 gap-1 px-2"
              onClick={handleExecute}
              disabled={tab.isExecuting || !tab.query.trim()}
            >
              {tab.isExecuting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              Run
            </Button>
            {showCloseButton && onClose && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                title="Close split"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Editor */}
        <div className="shrink-0 border-b">
          <MonacoSqlEditor
            value={tab.query}
            onChange={handleQueryChange}
            onExecute={handleExecute}
            schema={schema}
          />
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-hidden">
          {tab.isExecuting ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
            </div>
          ) : tab.error ? (
            <div className="flex h-full items-center justify-center p-4">
              <div className="border-destructive/50 bg-destructive/10 flex max-w-md items-start gap-3 rounded-lg border p-4">
                <AlertCircle className="text-destructive h-5 w-5 shrink-0" />
                <div>
                  <p className="text-destructive font-medium">Query Error</p>
                  <p className="text-destructive/80 mt-1 text-sm">
                    {tab.error}
                  </p>
                </div>
              </div>
            </div>
          ) : tab.results ? (
            <div className="flex h-full flex-col">
              {/* Results Header */}
              <div className="text-muted-foreground flex items-center gap-4 border-b px-4 py-2 text-sm">
                <span>{tab.results.rowsAffected} rows</span>
                {tab.executionTime !== null && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {tab.executionTime.toFixed(2)}ms
                  </span>
                )}
              </div>
              {/* Results Table */}
              <div className="h-0 flex-1 overflow-hidden">
                <QueryResults results={tab.results} />
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground flex h-full items-center justify-center">
              <p>Execute a query to see results</p>
            </div>
          )}
        </div>

        {/* Query Optimizer Panel */}
        <QueryOptimizerPanel
          open={showOptimizer}
          onOpenChange={setShowOptimizer}
          query={tab.query}
          onAnalyze={handleAnalyze}
        />
      </div>
    );
  }
);
