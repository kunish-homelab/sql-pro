import type { DatabaseSchema, TableSchema } from '@/types/database';
import type {
  Cardinality,
  EREdgeData,
  ERRelationshipEdge,
  ERTableNode,
  ERTableNodeData,
} from '@/types/er-diagram';

/**
 * Generates a unique node ID for a table
 */
export function getTableNodeId(table: TableSchema): string {
  return `${table.schema}.${table.name}`;
}

/**
 * Determines the cardinality of a foreign key relationship
 * - 1:1 if FK column has unique constraint or is part of PK
 * - 1:N otherwise (most common)
 */
function determineCardinality(
  table: TableSchema,
  fkColumn: string
): Cardinality {
  // Check if FK column is part of primary key
  if (table.primaryKey.includes(fkColumn)) {
    return '1:1';
  }

  // Check if FK column has a unique index
  const hasUniqueIndex = table.indexes.some(
    (idx) =>
      idx.isUnique && idx.columns.length === 1 && idx.columns[0] === fkColumn
  );

  if (hasUniqueIndex) {
    return '1:1';
  }

  // Default: 1:N (one referenced row -> many source rows)
  return '1:N';
}

/**
 * Converts database schema to React Flow nodes
 */
export function schemaToNodes(schema: DatabaseSchema): ERTableNode[] {
  const allTables = [...schema.tables, ...schema.views];

  return allTables.map((table) => {
    const nodeData: ERTableNodeData = {
      tableName: table.name,
      schema: table.schema,
      columns: table.columns,
      primaryKey: table.primaryKey,
      foreignKeys: table.foreignKeys,
      indexes: table.indexes,
      isView: table.type === 'view',
    };

    return {
      id: getTableNodeId(table),
      type: 'erTable',
      position: { x: 0, y: 0 }, // Will be computed by layout algorithm
      data: nodeData,
    };
  });
}

/**
 * Converts database schema to React Flow edges (FK relationships)
 */
export function schemaToEdges(schema: DatabaseSchema): ERRelationshipEdge[] {
  const edges: ERRelationshipEdge[] = [];
  const allTables = [...schema.tables, ...schema.views];

  // Create a set of valid table IDs for validation
  const validTableIds = new Set(allTables.map((t) => getTableNodeId(t)));

  for (const table of allTables) {
    for (const fk of table.foreignKeys) {
      const sourceId = getTableNodeId(table);
      // Referenced table might be in same schema or need to find it
      const targetId = findReferencedTableId(
        schema,
        fk.referencedTable,
        table.schema
      );

      // Skip if target table doesn't exist in schema
      if (!targetId || !validTableIds.has(targetId)) {
        continue;
      }

      const edgeData: EREdgeData = {
        sourceColumn: fk.column,
        targetColumn: fk.referencedColumn,
        cardinality: determineCardinality(table, fk.column),
        onDelete: fk.onDelete,
        onUpdate: fk.onUpdate,
      };

      edges.push({
        id: `${sourceId}.${fk.column}->${targetId}.${fk.referencedColumn}`,
        source: sourceId,
        target: targetId,
        sourceHandle: fk.column,
        targetHandle: fk.referencedColumn,
        type: 'erRelationship',
        data: edgeData,
      });
    }
  }

  return edges;
}

/**
 * Finds the full table ID for a referenced table name
 * Searches in the same schema first, then in other schemas
 */
function findReferencedTableId(
  schema: DatabaseSchema,
  tableName: string,
  preferredSchema: string
): string | null {
  const allTables = [...schema.tables, ...schema.views];

  // First try to find in the same schema
  const sameSchemaTable = allTables.find(
    (t) => t.name === tableName && t.schema === preferredSchema
  );
  if (sameSchemaTable) {
    return getTableNodeId(sameSchemaTable);
  }

  // Then try any schema
  const anyTable = allTables.find((t) => t.name === tableName);
  if (anyTable) {
    return getTableNodeId(anyTable);
  }

  return null;
}

/**
 * Converts entire schema to nodes and edges
 */
export function schemaToNodesAndEdges(schema: DatabaseSchema): {
  nodes: ERTableNode[];
  edges: ERRelationshipEdge[];
} {
  return {
    nodes: schemaToNodes(schema),
    edges: schemaToEdges(schema),
  };
}
