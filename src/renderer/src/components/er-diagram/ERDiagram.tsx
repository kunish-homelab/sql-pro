import type { ColorMode, NodeChange, OnNodesChange } from '@xyflow/react';
import type { ERRelationshipEdge, ERTableNode } from '@/types/er-diagram';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import { useTheme } from 'next-themes';
import { useCallback, useEffect, useMemo } from 'react';
import { useConnectionStore } from '@/stores';
import { useDiagramStore } from '@/stores/diagram-store';
import { ERControls } from './ERControls';
import { ERRelationshipEdge as ERRelationshipEdgeComponent } from './ERRelationshipEdge';
import { ERTableNode as ERTableNodeComponent } from './ERTableNode';
import {
  applyAutoLayout,
  applyStoredPositions,
} from './utils/layout-algorithm';
import { schemaToNodesAndEdges } from './utils/schema-to-diagram';
import '@xyflow/react/dist/style.css';

// Register custom node and edge types
const nodeTypes = {
  erTable: ERTableNodeComponent,
};

const edgeTypes = {
  erRelationship: ERRelationshipEdgeComponent,
};

export function ERDiagram() {
  const { schema, connection, setSelectedTable } = useConnectionStore();
  const { resolvedTheme } = useTheme();
  const {
    getNodePositions,
    setNodePosition,
    setNodePositions,
    getViewport,
    setViewport,
    resetLayout,
  } = useDiagramStore();

  const dbPath = connection?.path || '';

  // Convert schema to nodes and edges
  const { initialNodes, initialEdges } = useMemo(() => {
    if (!schema) {
      return { initialNodes: [], initialEdges: [] };
    }

    const { nodes, edges } = schemaToNodesAndEdges(schema);
    const storedPositions = getNodePositions(dbPath);

    // Apply stored positions or auto-layout
    const positionedNodes =
      Object.keys(storedPositions).length > 0
        ? applyStoredPositions(nodes, edges, storedPositions)
        : applyAutoLayout(nodes, edges);

    return { initialNodes: positionedNodes, initialEdges: edges };
  }, [schema, dbPath, getNodePositions]);

  const [nodes, setNodes, onNodesChange] =
    useNodesState<ERTableNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] =
    useEdgesState<ERRelationshipEdge>(initialEdges);

  // Update nodes when schema changes
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Handle node position changes with persistence
  const handleNodesChange: OnNodesChange<ERTableNode> = useCallback(
    (changes: NodeChange<ERTableNode>[]) => {
      onNodesChange(changes);

      // Persist position changes
      changes.forEach((change) => {
        if (
          change.type === 'position' &&
          change.position &&
          change.dragging === false
        ) {
          setNodePosition(dbPath, change.id, change.position);
        }
      });
    },
    [onNodesChange, dbPath, setNodePosition]
  );

  // Handle viewport changes
  const handleMoveEnd = useCallback(
    (_event: unknown, viewport: { x: number; y: number; zoom: number }) => {
      setViewport(dbPath, viewport);
    },
    [dbPath, setViewport]
  );

  // Handle reset layout
  const handleResetLayout = useCallback(() => {
    if (!schema) return;

    resetLayout(dbPath);

    const { nodes: freshNodes, edges: freshEdges } =
      schemaToNodesAndEdges(schema);
    const layoutedNodes = applyAutoLayout(freshNodes, freshEdges);

    // Save new positions
    const newPositions: Record<string, { x: number; y: number }> = {};
    layoutedNodes.forEach((node) => {
      newPositions[node.id] = node.position;
    });
    setNodePositions(dbPath, newPositions);

    setNodes(layoutedNodes);
    setEdges(freshEdges);
  }, [schema, dbPath, resetLayout, setNodePositions, setNodes, setEdges]);

  // Handle node click - navigate to table
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: ERTableNode) => {
      const table = schema?.tables.find(
        (t) => t.name === node.data.tableName && t.schema === node.data.schema
      );
      if (table) {
        setSelectedTable(table);
      }
    },
    [schema, setSelectedTable]
  );

  // Get initial viewport
  const defaultViewport = getViewport(dbPath) || { x: 0, y: 0, zoom: 1 };

  if (!schema) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center">
        No schema loaded
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center">
        No tables in database
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onMoveEnd={handleMoveEnd}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode={resolvedTheme as ColorMode}
        defaultViewport={defaultViewport}
        fitView={!getViewport(dbPath)}
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls showInteractive={false} />
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
          className="!bg-background !border-border"
        />
        <ERControls onResetLayout={handleResetLayout} />
      </ReactFlow>
    </div>
  );
}
