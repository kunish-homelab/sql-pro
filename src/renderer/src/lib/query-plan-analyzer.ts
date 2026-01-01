import type { QueryPlanNode, QueryPlanStats } from '@shared/types';
import type { Edge, Node } from '@xyflow/react';
import dagre from 'dagre';

export interface Suggestion {
  type: 'index' | 'rewrite' | 'warning';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
}

// ============ Flow Diagram Types ============

export type WarningType =
  | 'full-scan'
  | 'missing-index'
  | 'temp-btree'
  | 'subquery';

export interface ExecutionPlanNodeData {
  [key: string]: unknown;
  operation: string; // e.g., "SCAN TABLE", "SEARCH INDEX"
  detail: string; // Full detail string
  estimatedCost?: number;
  estimatedRows?: number;
  hasWarning: boolean;
  warningType?: WarningType;
  tableName?: string; // Extracted table name if applicable
  indexName?: string; // Extracted index name if applicable
}

/**
 * Gets a human-readable description for each warning type
 */
export function getWarningMessage(warningType: WarningType): {
  title: string;
  description: string;
} {
  switch (warningType) {
    case 'full-scan':
      return {
        title: 'Full Table Scan',
        description:
          'This operation scans all rows in the table. Consider adding an index to improve performance.',
      };
    case 'temp-btree':
      return {
        title: 'Temporary B-Tree',
        description:
          'A temporary structure is used for sorting. Consider adding an index on the ORDER BY columns.',
      };
    case 'subquery':
      return {
        title: 'Subquery Detected',
        description:
          'Subqueries can be expensive. Consider rewriting as a JOIN for better performance.',
      };
    case 'missing-index':
      return {
        title: 'Missing Index',
        description:
          'No index is available for this operation. Adding an index could significantly improve performance.',
      };
    default:
      return {
        title: 'Performance Warning',
        description: 'This operation may have performance implications.',
      };
  }
}

export type ExecutionPlanFlowNode = Node<
  ExecutionPlanNodeData,
  'executionPlan'
>;
export type ExecutionPlanFlowEdge = Edge;

// Layout configuration
const NODE_WIDTH = 280;
const NODE_HEIGHT = 120;
const NODE_SEPARATION = 80; // Horizontal space between nodes
const RANK_SEPARATION = 100; // Vertical space between levels
const MARGIN = 40;

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
  if ((stats.indexesUsed?.length ?? 0) === 0 && plan.length > 0) {
    suggestions.push({
      type: 'warning',
      title: 'No indexes used',
      description:
        'This query does not use any indexes. If the query filters or joins on specific columns, consider adding appropriate indexes.',
      impact: 'medium',
    });
  }

  // Check for multiple table accesses (potential join optimization)
  if ((stats.tablesAccessed?.length ?? 0) > 2) {
    suggestions.push({
      type: 'rewrite',
      title: 'Multiple tables accessed',
      description: `This query accesses ${stats.tablesAccessed?.length ?? 0} tables. Ensure all join columns are indexed and consider breaking complex queries into smaller parts.`,
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
  if (
    (stats.rowsReturned ?? 0) > 0 &&
    (stats.rowsExamined ?? 0) > (stats.rowsReturned ?? 0) * 10
  ) {
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
    (stats.indexesUsed?.length ?? 0) > 0 &&
    (stats.executionTime ?? 0) < 100
  ) {
    suggestions.push({
      type: 'rewrite',
      title: 'Query looks optimized',
      description: `The query uses ${stats.indexesUsed?.length ?? 0} index(es) and executes quickly. No obvious optimizations needed.`,
      impact: 'low',
    });
  }

  return suggestions;
}

// ============ Tree-to-Flow Conversion Utilities ============

/**
 * Detects if a query plan node has performance warnings
 */
export function detectWarning(node: QueryPlanNode): {
  hasWarning: boolean;
  warningType?: WarningType;
} {
  const detailUpper = node.detail.toUpperCase();

  // Check for full table scan
  if (detailUpper.includes('SCAN TABLE')) {
    return { hasWarning: true, warningType: 'full-scan' };
  }

  // Check for temp B-tree (sorting without index)
  if (
    detailUpper.includes('TEMP B-TREE') ||
    detailUpper.includes('USE TEMP B-TREE FOR ORDER BY')
  ) {
    return { hasWarning: true, warningType: 'temp-btree' };
  }

  // Check for subqueries
  if (
    detailUpper.includes('SCALAR SUBQUERY') ||
    detailUpper.includes('CORRELATED')
  ) {
    return { hasWarning: true, warningType: 'subquery' };
  }

  return { hasWarning: false };
}

/**
 * Extracts operation type from detail string
 * Examples: "SCAN TABLE users" -> "SCAN TABLE"
 *           "SEARCH TABLE users USING INDEX idx_email" -> "SEARCH INDEX"
 */
export function extractOperation(detail: string): string {
  const detailUpper = detail.toUpperCase();

  if (detailUpper.includes('SCAN TABLE')) {
    return 'SCAN TABLE';
  }
  if (detailUpper.includes('SEARCH') && detailUpper.includes('INDEX')) {
    return 'SEARCH INDEX';
  }
  if (detailUpper.includes('USE TEMP B-TREE')) {
    return 'TEMP B-TREE';
  }
  if (detailUpper.includes('SCALAR SUBQUERY')) {
    return 'SUBQUERY';
  }
  if (detailUpper.includes('COMPOUND')) {
    return 'COMPOUND';
  }
  if (detailUpper.includes('EXECUTE')) {
    return 'EXECUTE';
  }

  // Default: use first word or phrase
  const match = detail.match(/^([A-Z\s]+)/);
  return match ? match[1].trim() : 'OPERATION';
}

/**
 * Extracts table name from detail string
 */
export function extractTableName(detail: string): string | undefined {
  const tableMatch = detail.match(/TABLE\s+(\w+)/i);
  return tableMatch ? tableMatch[1] : undefined;
}

/**
 * Extracts index name from detail string
 */
export function extractIndexName(detail: string): string | undefined {
  const indexMatch = detail.match(/INDEX\s+(\w+)/i);
  return indexMatch ? indexMatch[1] : undefined;
}

/**
 * Converts a flat array of QueryPlanNode to a tree structure
 * SQLite returns flat array with parent references - this builds hierarchy
 */
export function buildPlanTree(nodes: QueryPlanNode[]): QueryPlanNode[] {
  if (nodes.length === 0) return [];

  // Create a map of id -> node for quick lookup
  const nodeMap = new Map<number, QueryPlanNode>();
  const roots: QueryPlanNode[] = [];

  // First pass: create map with copies of nodes
  nodes.forEach((node) => {
    nodeMap.set(node.id, { ...node, children: [] });
  });

  // Second pass: build tree structure
  nodes.forEach((node) => {
    const current = nodeMap.get(node.id);
    if (!current) return;

    if (node.parent === 0) {
      // Root node
      roots.push(current);
    } else {
      // Child node - add to parent's children
      const parent = nodeMap.get(node.parent);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(current);
      }
    }
  });

  return roots;
}

/**
 * Converts QueryPlanNode tree to React Flow nodes and edges
 */
export function planTreeToFlowNodes(planRoots: QueryPlanNode[]): {
  nodes: ExecutionPlanFlowNode[];
  edges: ExecutionPlanFlowEdge[];
} {
  const nodes: ExecutionPlanFlowNode[] = [];
  const edges: ExecutionPlanFlowEdge[] = [];

  function traverse(node: QueryPlanNode, depth: number = 0): void {
    const { hasWarning, warningType } = detectWarning(node);
    const operation = extractOperation(node.detail);
    const tableName = extractTableName(node.detail);
    const indexName = extractIndexName(node.detail);

    // Create flow node
    const flowNode: ExecutionPlanFlowNode = {
      id: `plan-node-${node.id}`,
      type: 'executionPlan',
      position: { x: 0, y: 0 }, // Will be set by layout algorithm
      data: {
        operation,
        detail: node.detail,
        estimatedCost: node.estimatedCost,
        estimatedRows: node.estimatedRows,
        hasWarning,
        warningType,
        tableName,
        indexName,
      },
    };

    nodes.push(flowNode);

    // Create edges from parent to children
    if (node.children && node.children.length > 0) {
      node.children.forEach((child) => {
        edges.push({
          id: `edge-${node.id}-${child.id}`,
          source: `plan-node-${node.id}`,
          target: `plan-node-${child.id}`,
          type: 'smoothstep',
          animated: false,
        });

        // Recursively process children
        traverse(child, depth + 1);
      });
    }
  }

  // Process all root nodes
  planRoots.forEach((root) => traverse(root, 0));

  return { nodes, edges };
}

/**
 * Applies dagre layout to execution plan nodes
 */
export function applyExecutionPlanLayout(
  nodes: ExecutionPlanFlowNode[],
  edges: ExecutionPlanFlowEdge[]
): ExecutionPlanFlowNode[] {
  if (nodes.length === 0) {
    return nodes;
  }

  // Single node - just position it
  if (nodes.length === 1) {
    return [{ ...nodes[0], position: { x: MARGIN, y: MARGIN } }];
  }

  const g = new dagre.graphlib.Graph();

  // Set graph options - top to bottom flow for execution plan
  g.setGraph({
    rankdir: 'TB', // Top to bottom
    nodesep: NODE_SEPARATION,
    ranksep: RANK_SEPARATION,
    marginx: MARGIN,
    marginy: MARGIN,
    ranker: 'network-simplex',
  });

  // Required for dagre
  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes with their dimensions
  nodes.forEach((node) => {
    g.setNode(node.id, {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    });
  });

  // Add edges
  edges.forEach((edge) => {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target, {
        weight: 1,
        minlen: 1,
      });
    }
  });

  // Run the layout algorithm
  try {
    dagre.layout(g);
  } catch {
    // On error, use simple vertical layout
    return nodes.map((node, index) => ({
      ...node,
      position: {
        x: MARGIN,
        y: MARGIN + index * (NODE_HEIGHT + RANK_SEPARATION),
      },
    }));
  }

  // Apply computed positions to nodes
  return nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);

    if (!nodeWithPosition) {
      return node;
    }

    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });
}

/**
 * Main conversion function: QueryPlanNode[] -> positioned flow nodes/edges
 */
export function convertPlanToFlow(planNodes: QueryPlanNode[]): {
  nodes: ExecutionPlanFlowNode[];
  edges: ExecutionPlanFlowEdge[];
} {
  // Build tree from flat array
  const planTree = buildPlanTree(planNodes);

  // Convert tree to flow nodes and edges
  const { nodes: rawNodes, edges } = planTreeToFlowNodes(planTree);

  // Apply layout
  const layoutedNodes = applyExecutionPlanLayout(rawNodes, edges);

  return { nodes: layoutedNodes, edges };
}

// ============ Text Export Utilities ============

/**
 * Renders a single plan node as formatted text with proper indentation
 */
function renderPlanNodeAsText(node: QueryPlanNode, depth: number): string[] {
  const lines: string[] = [];
  const indent = '  '.repeat(depth);
  const prefix = depth > 0 ? '└─ ' : '';

  // Main operation line
  lines.push(`${indent}${prefix}${node.detail}`);

  // Add metrics if available
  if (node.estimatedCost || node.estimatedRows) {
    const metrics: string[] = [];
    if (node.estimatedCost) {
      metrics.push(`Cost: ${node.estimatedCost}`);
    }
    if (node.estimatedRows) {
      metrics.push(`Rows: ~${node.estimatedRows}`);
    }
    lines.push(`${indent}   ${metrics.join(' | ')}`);
  }

  return lines;
}

/**
 * Recursively renders plan tree nodes as formatted text
 */
function renderPlanTreeAsText(
  nodes: QueryPlanNode[],
  depth: number = 0
): string[] {
  const lines: string[] = [];

  nodes.forEach((node, index) => {
    // Render current node
    lines.push(...renderPlanNodeAsText(node, depth));

    // Render children if any
    if (node.children && node.children.length > 0) {
      lines.push(...renderPlanTreeAsText(node.children, depth + 1));
    }

    // Add spacing between root-level nodes (but not after the last one)
    if (depth === 0 && index < nodes.length - 1) {
      lines.push('');
    }
  });

  return lines;
}

/**
 * Exports query execution plan as formatted text
 */
export function exportPlanAsText(
  plan: QueryPlanNode[],
  stats: QueryPlanStats,
  query?: string
): string {
  const lines: string[] = [];

  // Header
  lines.push('=== Query Execution Plan ===');
  lines.push('');

  // Query (if provided)
  if (query && query.trim()) {
    lines.push('Query:');
    lines.push(query.trim());
    lines.push('');
  }

  // Statistics
  lines.push('Statistics:');
  lines.push(`  Execution Time: ${(stats.executionTime ?? 0).toFixed(2)}ms`);
  lines.push(`  Rows Examined: ${stats.rowsExamined ?? 0}`);
  lines.push(`  Rows Returned: ${stats.rowsReturned ?? 0}`);
  lines.push(`  Indexes Used: ${stats.indexesUsed?.join(', ') || 'None'}`);

  if (stats.tablesAccessed && stats.tablesAccessed.length > 0) {
    lines.push(`  Tables Accessed: ${stats.tablesAccessed.join(', ')}`);
  }

  lines.push('');

  // Execution steps
  lines.push('=== Execution Steps ===');
  lines.push('');

  if (plan.length === 0) {
    lines.push('No execution plan available');
  } else {
    // Build tree structure and render
    const planTree = buildPlanTree(plan);
    lines.push(...renderPlanTreeAsText(planTree));
  }

  lines.push('');
  lines.push('=== End of Plan ===');

  return lines.join('\n');
}
