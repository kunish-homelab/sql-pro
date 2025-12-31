import type { ERRelationshipEdge, ERTableNode } from '@/types/er-diagram';
import dagre from 'dagre';

// Estimated dimensions for table nodes
const NODE_WIDTH = 280; // Increased for wider tables
const COLUMN_HEIGHT = 26;
const HEADER_HEIGHT = 44;
const MIN_NODE_HEIGHT = 100;
const PADDING = 20;

// Layout spacing - increased for better readability
const NODE_SEPARATION = 100; // Horizontal space between nodes
const RANK_SEPARATION = 150; // Space between ranks (levels)
const MARGIN = 60; // Margin around the entire graph

/**
 * Calculates the height of a table node based on column count
 */
function calculateNodeHeight(node: ERTableNode): number {
  const columnsHeight = node.data.columns.length * COLUMN_HEIGHT;
  return Math.max(MIN_NODE_HEIGHT, HEADER_HEIGHT + columnsHeight + PADDING);
}

/**
 * Grid layout for nodes without relationships
 * Arranges nodes in a grid pattern, trying to balance width and height
 */
function applyGridLayout(nodes: ERTableNode[]): ERTableNode[] {
  if (nodes.length === 0) return nodes;
  if (nodes.length === 1) {
    return [{ ...nodes[0], position: { x: MARGIN, y: MARGIN } }];
  }

  // Calculate optimal grid dimensions
  // Prefer wider layouts (more columns than rows)
  const aspectRatio = 1.5; // Prefer 1.5:1 width to height ratio
  const cols = Math.ceil(Math.sqrt(nodes.length * aspectRatio));
  const rows = Math.ceil(nodes.length / cols);

  // Calculate max height in each row for proper spacing
  const rowHeights: number[] = [];
  for (let row = 0; row < rows; row++) {
    let maxHeight = MIN_NODE_HEIGHT;
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      if (idx < nodes.length) {
        maxHeight = Math.max(maxHeight, calculateNodeHeight(nodes[idx]));
      }
    }
    rowHeights.push(maxHeight);
  }

  // Position nodes
  const GAP_X = NODE_WIDTH + NODE_SEPARATION;
  let currentY = MARGIN;

  return nodes.map((node, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);

    // Calculate Y position based on previous rows
    if (col === 0 && row > 0) {
      currentY += rowHeights[row - 1] + NODE_SEPARATION;
    }

    const y = row === 0 ? MARGIN : currentY;

    return {
      ...node,
      position: {
        x: MARGIN + col * GAP_X,
        y,
      },
    };
  });
}

/**
 * Checks if nodes are mostly unconnected
 * Returns true if less than 30% of nodes have relationships
 */
function isMostlyUnconnected(
  nodes: ERTableNode[],
  edges: ERRelationshipEdge[]
): boolean {
  if (nodes.length <= 1) return true;
  if (edges.length === 0) return true;

  // Count nodes that are part of at least one edge
  const connectedNodes = new Set<string>();
  edges.forEach((edge) => {
    connectedNodes.add(edge.source);
    connectedNodes.add(edge.target);
  });

  const connectionRatio = connectedNodes.size / nodes.length;
  return connectionRatio < 0.3;
}

/**
 * Applies automatic layout to nodes using dagre library
 * Falls back to grid layout when nodes are mostly unconnected
 */
export function applyAutoLayout(
  nodes: ERTableNode[],
  edges: ERRelationshipEdge[],
  direction: 'LR' | 'TB' = 'LR'
): ERTableNode[] {
  if (nodes.length === 0) {
    return nodes;
  }

  // For single node, just position it
  if (nodes.length === 1) {
    return [{ ...nodes[0], position: { x: MARGIN, y: MARGIN } }];
  }

  // Use grid layout if nodes are mostly unconnected
  if (isMostlyUnconnected(nodes, edges)) {
    return applyGridLayout(nodes);
  }

  const g = new dagre.graphlib.Graph();

  // Set graph options with good spacing
  g.setGraph({
    rankdir: direction,
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
    const height = calculateNodeHeight(node);
    g.setNode(node.id, {
      width: NODE_WIDTH,
      height,
    });
  });

  // Add edges - dagre uses these to determine layout
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
  } catch (error) {
    console.error('Dagre layout failed:', error);
    return applyGridLayout(nodes);
  }

  // Apply computed positions to nodes
  return nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);

    if (!nodeWithPosition) {
      console.warn(`No position computed for node: ${node.id}`);
      return node;
    }

    const height = calculateNodeHeight(node);

    return {
      ...node,
      position: {
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
    const stored = storedPositions[node.id];
    if (
      stored &&
      typeof stored.x === 'number' &&
      typeof stored.y === 'number'
    ) {
      nodesWithStoredPositions.push({
        ...node,
        position: stored,
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
  let maxX = -Infinity;
  let minY = Infinity;

  nodesWithStoredPositions.forEach((node) => {
    maxX = Math.max(maxX, node.position.x + NODE_WIDTH);
    minY = Math.min(minY, node.position.y);
  });

  const startX = maxX + RANK_SEPARATION;
  let currentY = minY;

  const newlyPositionedNodes = nodesNeedingLayout.map((node) => {
    const height = calculateNodeHeight(node);
    const positioned = {
      ...node,
      position: { x: startX, y: currentY },
    };
    currentY += height + NODE_SEPARATION;
    return positioned;
  });

  return [...nodesWithStoredPositions, ...newlyPositionedNodes];
}

/**
 * Re-layout all nodes, useful when user wants to reset the diagram
 */
export function forceAutoLayout(
  nodes: ERTableNode[],
  edges: ERRelationshipEdge[],
  direction: 'LR' | 'TB' = 'LR'
): ERTableNode[] {
  const nodesWithoutPositions = nodes.map((node) => ({
    ...node,
    position: { x: 0, y: 0 },
  }));

  return applyAutoLayout(nodesWithoutPositions, edges, direction);
}
