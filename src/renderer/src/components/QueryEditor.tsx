import { useState, useCallback } from 'react';
import { Play, Clock, AlertCircle, History, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useConnectionStore, useQueryStore } from '@/stores';
import { QueryResults } from './QueryResults';
import { MonacoSqlEditor } from './MonacoSqlEditor';

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
  } = useQueryStore();

  const [showHistory, setShowHistory] = useState(false);

  const handleExecute = useCallback(async () => {
    if (!connection || !currentQuery.trim()) return;

    setIsExecuting(true);
    setError(null);
    setResults(null);

    try {
      const result = await window.sqlPro.db.executeQuery({
        connectionId: connection.id,
        query: currentQuery.trim(),
      });

      if (result.success) {
        setResults({
          columns: result.columns || [],
          rows: result.rows || [],
          rowsAffected: result.rowsAffected || 0,
          lastInsertRowId: result.lastInsertRowId,
        });
        setExecutionTime(result.executionTime || 0);
        addToHistory(currentQuery.trim(), true, result.rowsAffected);
      } else {
        setError(result.error || 'Query failed');
        addToHistory(currentQuery.trim(), false);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      addToHistory(currentQuery.trim(), false);
    } finally {
      setIsExecuting(false);
    }
  }, [
    connection,
    currentQuery,
    setIsExecuting,
    setError,
    setResults,
    setExecutionTime,
    addToHistory,
  ]);

  const handleHistorySelect = (query: string) => {
    setCurrentQuery(query);
    setShowHistory(false);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Editor Header */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <h2 className="font-medium">SQL Query</h2>
          <span className="text-xs text-muted-foreground">
            Cmd/Ctrl+Enter to execute
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className="gap-1"
          >
            <History className="h-4 w-4" />
            History
          </Button>
          <Button
            size="sm"
            onClick={handleExecute}
            disabled={isExecuting || !currentQuery.trim()}
            className="gap-1"
          >
            {isExecuting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Execute
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Editor */}
        <div className="flex flex-1 flex-col">
          <div className="shrink-0 border-b">
            <MonacoSqlEditor
              value={currentQuery}
              onChange={setCurrentQuery}
              onExecute={handleExecute}
              schema={schema}
            />
          </div>

          {/* Results Area */}
          <div className="flex-1 overflow-hidden">
            {isExecuting ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="flex h-full items-center justify-center p-4">
                <div className="flex max-w-md items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                  <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
                  <div>
                    <p className="font-medium text-destructive">Query Error</p>
                    <p className="mt-1 text-sm text-destructive/80">{error}</p>
                  </div>
                </div>
              </div>
            ) : results ? (
              <div className="flex h-full flex-col">
                {/* Results Header */}
                <div className="flex items-center gap-4 border-b px-4 py-2 text-sm text-muted-foreground">
                  <span>{results.rowsAffected} rows</span>
                  {executionTime !== null && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {executionTime.toFixed(2)}ms
                    </span>
                  )}
                  {results.lastInsertRowId !== undefined && (
                    <span>Last Insert ID: {results.lastInsertRowId}</span>
                  )}
                </div>
                {/* Results Table */}
                <div className="flex-1 overflow-hidden">
                  <QueryResults results={results} />
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <p>Execute a query to see results</p>
              </div>
            )}
          </div>
        </div>

        {/* History Panel */}
        {showHistory && (
          <div className="w-80 border-l">
            <div className="flex items-center justify-between border-b px-4 py-2">
              <h3 className="font-medium">Query History</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowHistory(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <ScrollArea className="h-full">
              <div className="space-y-1 p-2">
                {history.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No queries yet
                  </p>
                ) : (
                  history.map((item, index) => (
                    <button
                      key={index}
                      onClick={() => handleHistorySelect(item.query)}
                      className={cn(
                        'w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
                        !item.success && 'border-l-2 border-destructive'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {item.success ? (
                          <span className="text-xs text-green-600">
                            {item.rowsAffected} rows
                          </span>
                        ) : (
                          <span className="text-xs text-destructive">
                            Failed
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.executedAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="mt-1 truncate font-mono text-xs">
                        {item.query}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
