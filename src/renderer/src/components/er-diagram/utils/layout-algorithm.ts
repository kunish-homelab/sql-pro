import type { ERRelationshipEdge, ERTableNode } from '@/types/er-diagram';
import dagre from 'dagre';

// Estimated dimensions for table nodes
const NODE_WIDTH = 220;
const COLUMN_HEIGHT = 24;
const HEADER_HEIGHT = 40;
const MIN_NODE_HEIGHT = 80;

/**
 * Calculates the height of a table node based on column count
 */
function calculateNodeHeight(node: ERTableNode): number {
  const columnsHeight = node.data.columns.length * COLUMN_HEIGHT;
  return Math.max(MIN_NODE_HEIGHT, HEADER_HEIGHT + columnsHeight);
}

/**
 * Applies automatic layout to nodes using dagre library
 * Uses left-to-right direction for ER diagrams
 */
export function applyAutoLayout(
  nodes: ERTableNode[],
  edges: ERRelationshipEdge[],
  direction: 'LR' | 'TB' = 'LR'
): ERTableNode[] {
  if (nodes.length === 0) {
    return nodes;
  }

  const g = new dagre.graphlib.Graph();

  // Set graph options
  g.setGraph({
    rankdir: direction,
    nodesep: 60, // Horizontal space between nodes
    ranksep: 100, // Vertical space between ranks
    marginx: 40,
    marginy: 40,
  });

  // Required for dagre
  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes with their dimensions
  nodes.forEach((node) => {
    const height = calculateNodeHeight(node);
    g.setNode(node.id, {
      width: NODE_WIDTH,
      height,
    });
  });

  // Add edges
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  // Run the layout algorithm
  dagre.layout(g);

  // Apply computed positions to nodes
  return nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    const height = calculateNodeHeight(node);

    return {
      ...node,
      position: {
        // dagre returns center position, convert to top-left
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - height / 2,
      },
    };
  });
}

/**
 * Applies saved positions to nodes, falling back to auto-layout for new nodes
 */
export function applyStoredPositions(
  nodes: ERTableNode[],
  edges: ERRelationshipEdge[],
  storedPositions: Record<string, { x: number; y: number }>
): ERTableNode[] {
  const nodesWithStoredPositions: ERTableNode[] = [];
  const nodesNeedingLayout: ERTableNode[] = [];

  // Separate nodes with stored positions from those needing layout
  nodes.forEach((node) => {
    if (storedPositions[node.id]) {
      nodesWithStoredPositions.push({
        ...node,
        position: storedPositions[node.id],
      });
    } else {
      nodesNeedingLayout.push(node);
    }
  });

  // If all nodes have stored positions, use them
  if (nodesNeedingLayout.length === 0) {
    return nodesWithStoredPositions;
  }

  // If no nodes have stored positions, apply full auto-layout
  if (nodesWithStoredPositions.length === 0) {
    return applyAutoLayout(nodes, edges);
  }

  // For nodes without positions, find a suitable position
  // Place them to the right of existing nodes
  const maxX =
    Math.max(...nodesWithStoredPositions.map((n) => n.position.x)) +
    NODE_WIDTH +
    100;
  let currentY = 0;

  const newlyPositionedNodes = nodesNeedingLayout.map((node) => {
    const height = calculateNodeHeight(node);
    const positioned = {
      ...node,
      position: { x: maxX, y: currentY },
    };
    currentY += height + 40;
    return positioned;
  });

  return [...nodesWithStoredPositions, ...newlyPositionedNodes];
}
