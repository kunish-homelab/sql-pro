import type { Edge, Node } from '@xyflow/react';
import type { ColumnSchema, ForeignKeySchema, IndexSchema } from './database';

// Cardinality types for relationships
export type Cardinality = '1:1' | '1:N' | 'N:1' | 'M:N';

// Data for table nodes
export interface ERTableNodeData {
  tableName: string;
  schema: string;
  columns: ColumnSchema[];
  primaryKey: string[];
  foreignKeys: ForeignKeySchema[];
  indexes: IndexSchema[];
  isView: boolean;
}

// Data for relationship edges
export interface EREdgeData {
  sourceColumn: string;
  targetColumn: string;
  cardinality: Cardinality;
  onDelete?: string;
  onUpdate?: string;
}

// Custom node type
export type ERTableNode = Node<ERTableNodeData, 'erTable'>;

// Custom edge type
export type ERRelationshipEdge = Edge<EREdgeData>;

// Diagram viewport state
export interface DiagramViewport {
  x: number;
  y: number;
  zoom: number;
}

// Node position for persistence
export interface NodePosition {
  x: number;
  y: number;
}

// Stored diagram state (per database)
export interface StoredDiagramState {
  nodePositions: Record<string, NodePosition>;
  viewport?: DiagramViewport;
}
