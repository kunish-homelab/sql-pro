import type { QueryPlanNode, QueryPlanStats } from '../../../shared/types';

export interface Suggestion {
  type: 'index' | 'rewrite' | 'warning';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
}

/**
 * Generates optimization suggestions based on query execution plan
 */
export function generateSuggestions(
  plan: QueryPlanNode[],
  stats: QueryPlanStats
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // Check for full table scans
  const fullTableScans = plan.filter((node) =>
    node.detail.toUpperCase().includes('SCAN TABLE')
  );

  for (const scan of fullTableScans) {
    const tableMatch = scan.detail.match(/SCAN TABLE (\w+)/i);
    const tableName = tableMatch ? tableMatch[1] : 'unknown';

    suggestions.push({
      type: 'index',
      title: `Full table scan on "${tableName}"`,
      description: `Consider adding an index on the columns used in WHERE or JOIN clauses for table "${tableName}" to improve query performance.`,
      impact: 'high',
    });
  }

  // Check if no indexes are used
  if (stats.indexesUsed.length === 0 && plan.length > 0) {
    suggestions.push({
      type: 'warning',
      title: 'No indexes used',
      description:
        'This query does not use any indexes. If the query filters or joins on specific columns, consider adding appropriate indexes.',
      impact: 'medium',
    });
  }

  // Check for multiple table accesses (potential join optimization)
  if (stats.tablesAccessed.length > 2) {
    suggestions.push({
      type: 'rewrite',
      title: 'Multiple tables accessed',
      description: `This query accesses ${stats.tablesAccessed.length} tables. Ensure all join columns are indexed and consider breaking complex queries into smaller parts.`,
      impact: 'medium',
    });
  }

  // Check for subquery patterns
  const hasSubquery = plan.some(
    (node) =>
      node.detail.toUpperCase().includes('SCALAR SUBQUERY') ||
      node.detail.toUpperCase().includes('CORRELATED')
  );

  if (hasSubquery) {
    suggestions.push({
      type: 'rewrite',
      title: 'Subquery detected',
      description:
        'Consider rewriting subqueries as JOINs for potentially better performance.',
      impact: 'medium',
    });
  }

  // Check for TEMP B-TREE (sorting without index)
  const hasTempBTree = plan.some((node) =>
    node.detail.toUpperCase().includes('TEMP B-TREE')
  );

  if (hasTempBTree) {
    suggestions.push({
      type: 'index',
      title: 'Temporary B-tree for sorting',
      description:
        'The query uses a temporary B-tree for sorting. Consider adding an index on the ORDER BY columns to avoid this overhead.',
      impact: 'medium',
    });
  }

  // Check for USE TEMP B-TREE FOR ORDER BY
  const hasTempOrderBy = plan.some((node) =>
    node.detail.toUpperCase().includes('USE TEMP B-TREE FOR ORDER BY')
  );

  if (hasTempOrderBy) {
    suggestions.push({
      type: 'index',
      title: 'Sorting not covered by index',
      description:
        'The ORDER BY clause requires a temporary structure. Adding an index that covers the sort columns could improve performance.',
      impact: 'low',
    });
  }

  // Check for COMPOUND queries (UNION, EXCEPT, INTERSECT)
  const hasCompound = plan.some((node) =>
    node.detail.toUpperCase().includes('COMPOUND')
  );

  if (hasCompound) {
    suggestions.push({
      type: 'rewrite',
      title: 'Compound query detected',
      description:
        'UNION/EXCEPT/INTERSECT operations can be expensive. Consider if a single query with appropriate WHERE clauses could achieve the same result.',
      impact: 'low',
    });
  }

  // Check for high rows examined vs returned ratio
  if (stats.rowsReturned > 0 && stats.rowsExamined > stats.rowsReturned * 10) {
    suggestions.push({
      type: 'warning',
      title: 'High scan-to-return ratio',
      description: `The query examined ${stats.rowsExamined} rows but only returned ${stats.rowsReturned}. This indicates the query could benefit from more selective indexes.`,
      impact: 'high',
    });
  }

  // If query is fast and uses indexes, give positive feedback
  if (
    suggestions.length === 0 &&
    stats.indexesUsed.length > 0 &&
    stats.executionTime < 100
  ) {
    suggestions.push({
      type: 'rewrite',
      title: 'Query looks optimized',
      description: `The query uses ${stats.indexesUsed.length} index(es) and executes quickly. No obvious optimizations needed.`,
      impact: 'low',
    });
  }

  return suggestions;
}
