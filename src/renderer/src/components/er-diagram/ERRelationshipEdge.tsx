import type { EdgeProps } from '@xyflow/react';
import type { EREdgeData } from '@/types/er-diagram';
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react';
import { memo } from 'react';

interface ERRelationshipEdgeProps extends EdgeProps<EREdgeData> {}

/**
 * Renders cardinality markers (crow's foot notation)
 */
function CardinalityMarker({
  cardinality,
  position,
}: {
  cardinality: string;
  position: 'source' | 'target';
}) {
  // Determine which end to show based on cardinality
  // 1:N means source is "1" side, target is "N" side
  const isMany =
    (position === 'target' && cardinality === '1:N') ||
    (position === 'source' && cardinality === 'N:1') ||
    cardinality === 'M:N';

  const isOne =
    (position === 'source' && cardinality === '1:N') ||
    (position === 'target' && cardinality === 'N:1') ||
    cardinality === '1:1';

  if (isMany) {
    return <span className="font-mono text-xs">N</span>;
  }
  if (isOne) {
    return <span className="font-mono text-xs">1</span>;
  }
  return null;
}

function ERRelationshipEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: ERRelationshipEdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const cardinality = data?.cardinality || '1:N';

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: selected
            ? 'hsl(var(--primary))'
            : 'hsl(var(--muted-foreground))',
          strokeWidth: selected ? 2 : 1.5,
        }}
      />
      <EdgeLabelRenderer>
        {/* Relationship label */}
        <div
          className="nodrag nopan pointer-events-auto"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
        >
          <div className="bg-background/90 flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs shadow-sm">
            <CardinalityMarker cardinality={cardinality} position="source" />
            <span className="text-muted-foreground">:</span>
            <CardinalityMarker cardinality={cardinality} position="target" />
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const ERRelationshipEdge = memo(ERRelationshipEdgeComponent);
