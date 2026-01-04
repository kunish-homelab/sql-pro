import type { TableRowData } from './data-table';
import type {
  ColumnSchema,
  QueryResult,
  QueryResultSet,
} from '@/types/database';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { DataTable } from './data-table';

interface QueryResultsProps {
  results: QueryResult;
}

interface SingleResultTableProps {
  columns: string[];
  rows: Record<string, unknown>[];
}

function SingleResultTable({ columns, rows }: SingleResultTableProps) {
  // Convert simple column names to ColumnSchema objects for DataTable
  const tableColumns = useMemo<ColumnSchema[]>(() => {
    return columns.map((colName) => ({
      name: colName,
      type: 'TEXT', // Generic type for query results
      nullable: true,
      defaultValue: null,
      isPrimaryKey: false,
    }));
  }, [columns]);

  // Convert rows to TableRowData format (add __rowId)
  const data = useMemo<TableRowData[]>(() => {
    return rows.map((row, index) => ({
      ...row,
      __rowId: index,
    }));
  }, [rows]);

  if (columns.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center">
        <p>Query executed successfully (no results to display)</p>
      </div>
    );
  }

  return (
    <DataTable
      columns={tableColumns}
      data={data}
      editable={false}
      className="h-full"
    />
  );
}

export function QueryResults({ results }: QueryResultsProps) {
  const [activeResultIndex, setActiveResultIndex] = useState(0);

  // Check if we have multiple result sets
  const hasMultipleResults =
    results.resultSets && results.resultSets.length > 1;

  // Get the result sets to display
  const resultSets: QueryResultSet[] = useMemo(() => {
    if (results.resultSets && results.resultSets.length > 0) {
      return results.resultSets;
    }
    // Fall back to single result format
    return [{ columns: results.columns, rows: results.rows }];
  }, [results]);

  // Handle case where no results
  if (
    resultSets.length === 0 ||
    (resultSets.length === 1 && resultSets[0].columns.length === 0)
  ) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center">
        <p>Query executed successfully (no results to display)</p>
      </div>
    );
  }

  // Single result set - show directly
  if (!hasMultipleResults) {
    return (
      <SingleResultTable
        columns={resultSets[0].columns}
        rows={resultSets[0].rows}
      />
    );
  }

  // Multiple result sets - show with tabs
  const activeResult = resultSets[activeResultIndex] || resultSets[0];

  return (
    <div className="flex h-full flex-col">
      {/* Result Set Tabs */}
      <div className="bg-muted/30 flex items-center gap-1 overflow-x-auto border-b px-2 py-1">
        {resultSets.map((resultSet, index) => (
          <button
            key={`result-${resultSet.columns.join(',')}-${resultSet.rows.length}`}
            onClick={() => setActiveResultIndex(index)}
            className={cn(
              'flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors',
              activeResultIndex === index
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
            )}
          >
            <span>Result {index + 1}</span>
            <span className="text-muted-foreground/70">
              ({resultSet.rows.length} rows)
            </span>
          </button>
        ))}
      </div>

      {/* Active Result Table */}
      <div className="min-h-0 flex-1">
        <SingleResultTable
          columns={activeResult.columns}
          rows={activeResult.rows}
        />
      </div>
    </div>
  );
}
