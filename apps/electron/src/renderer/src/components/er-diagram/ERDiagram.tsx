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
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useConnectionStore } from '@/stores';
import { useDiagramStore } from '@/stores/diagram-store';
import { ERControls } from './ERControls';
import { ERRelationshipEdge as ERRelationshipEdgeComponent } from './ERRelationshipEdge';
import { ERTableNode as ERTableNodeComponent } from './ERTableNode';
import { applyAutoLayout } from './utils/layout-algorithm';
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
    nodePositionsMap,
    setNodePosition,
    setNodePositions,
    viewportMap,
    setViewport,
    resetLayout,
  } = useDiagramStore();

  const dbPath = connection?.path || '';
  const hasAppliedInitialLayout = useRef(false);

  // Get stored positions for current database
  const storedPositions = useMemo(() => {
    return nodePositionsMap[dbPath] || {};
  }, [nodePositionsMap, dbPath]);

  // Get stored viewport for current database
  const storedViewport = useMemo(() => {
    return viewportMap[dbPath];
  }, [viewportMap, dbPath]);

  // Convert schema to nodes and edges
  const { rawNodes, rawEdges } = useMemo(() => {
    if (!schema) {
      return { rawNodes: [], rawEdges: [] };
    }
    const { nodes, edges } = schemaToNodesAndEdges(schema);
    return { rawNodes: nodes, rawEdges: edges };
  }, [schema]);

  // Apply layout to nodes
  const layoutedNodes = useMemo(() => {
    if (rawNodes.length === 0) {
      return [];
    }

    const hasStoredPositions = Object.keys(storedPositions).length > 0;

    // Check if all nodes have stored positions
    const allNodesHavePositions =
      hasStoredPositions &&
      rawNodes.every((node) => {
        const pos = storedPositions[node.id];
        return pos && typeof pos.x === 'number' && typeof pos.y === 'number';
      });

    if (allNodesHavePositions) {
      // Use stored positions
      return rawNodes.map((node) => ({
        ...node,
        position: storedPositions[node.id],
      }));
    }

    // Apply auto-layout for all nodes
    return applyAutoLayout(rawNodes, rawEdges, 'LR');
  }, [rawNodes, rawEdges, storedPositions]);

  const [nodes, setNodes, onNodesChange] =
    useNodesState<ERTableNode>(layoutedNodes);
  const [edges, setEdges, onEdgesChange] =
    useEdgesState<ERRelationshipEdge>(rawEdges);

  // Update nodes when schema or layout changes
  useEffect(() => {
    if (layoutedNodes.length > 0) {
      setNodes(layoutedNodes);
      setEdges(rawEdges);

      // Save positions if this is a fresh layout (no stored positions)
      const hasStoredPositions = Object.keys(storedPositions).length > 0;
      if (!hasStoredPositions && !hasAppliedInitialLayout.current) {
        hasAppliedInitialLayout.current = true;
        const newPositions: Record<string, { x: number; y: number }> = {};
        layoutedNodes.forEach((node) => {
          newPositions[node.id] = node.position;
        });
        setNodePositions(dbPath, newPositions);
      }
    }
  }, [
    layoutedNodes,
    rawEdges,
    setNodes,
    setEdges,
    storedPositions,
    dbPath,
    setNodePositions,
  ]);

  // Reset the initial layout flag when database changes
  useEffect(() => {
    hasAppliedInitialLayout.current = false;
  }, [dbPath]);

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
    const layoutedNewNodes = applyAutoLayout(freshNodes, freshEdges, 'LR');

    // Save new positions
    const newPositions: Record<string, { x: number; y: number }> = {};
    layoutedNewNodes.forEach((node) => {
      newPositions[node.id] = node.position;
    });
    setNodePositions(dbPath, newPositions);

    setNodes(layoutedNewNodes);
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
  const defaultViewport = storedViewport || { x: 0, y: 0, zoom: 1 };

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
        fitView={!storedViewport}
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
          className="bg-background! border-border!"
        />
        <ERControls onResetLayout={handleResetLayout} />
      </ReactFlow>
    </div>
  );
}
