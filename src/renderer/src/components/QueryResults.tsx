import { useMemo } from 'react';
import { DataTable, TableRowData } from './data-table';
import type { QueryResult, ColumnSchema } from '@/types/database';

interface QueryResultsProps {
  results: QueryResult;
}

export function QueryResults({ results }: QueryResultsProps) {
  // Convert simple column names to ColumnSchema objects for DataTable
  const columns = useMemo<ColumnSchema[]>(() => {
    return results.columns.map((colName) => ({
      name: colName,
      type: 'TEXT', // Generic type for query results
      nullable: true,
      defaultValue: null,
      isPrimaryKey: false,
    }));
  }, [results.columns]);

  // Convert rows to TableRowData format (add __rowId)
  const data = useMemo<TableRowData[]>(() => {
    return results.rows.map((row, index) => ({
      ...row,
      __rowId: index,
    }));
  }, [results.rows]);

  if (results.columns.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p>Query executed successfully (no results to display)</p>
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={data}
      editable={false}
      className="h-full"
    />
  );
}
