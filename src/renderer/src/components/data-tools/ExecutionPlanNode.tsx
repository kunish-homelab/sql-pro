import type { ExecutionPlanNodeData } from '@/lib/query-plan-analyzer';
import { Handle, Position } from '@xyflow/react';
import {
  AlertTriangle,
  Database,
  HardDrive,
  Search,
  Table,
  Zap,
} from 'lucide-react';
import { memo } from 'react';
import { cn } from '@/lib/utils';

interface ExecutionPlanNodeProps {
  data: ExecutionPlanNodeData;
  selected?: boolean;
}

const OPERATION_ICONS: Record<string, React.ElementType> = {
  'SCAN TABLE': Table,
  'SEARCH INDEX': Search,
  'TEMP B-TREE': HardDrive,
  SUBQUERY: Database,
  COMPOUND: Database,
  EXECUTE: Zap,
  default: Database,
};

const getOperationIcon = (operation: string): React.ElementType => {
  return OPERATION_ICONS[operation] || OPERATION_ICONS.default;
};

const WARNING_COLORS: Record<
  string,
  { border: string; bg: string; text: string }
> = {
  'full-scan': {
    border: 'border-red-500 dark:border-red-600',
    bg: 'bg-red-50 dark:bg-red-950/30',
    text: 'text-red-700 dark:text-red-400',
  },
  'temp-btree': {
    border: 'border-amber-500 dark:border-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    text: 'text-amber-700 dark:text-amber-400',
  },
  subquery: {
    border: 'border-blue-500 dark:border-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    text: 'text-blue-700 dark:text-blue-400',
  },
  'missing-index': {
    border: 'border-orange-500 dark:border-orange-600',
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    text: 'text-orange-700 dark:text-orange-400',
  },
};

function ExecutionPlanNodeComponent({
  data,
  selected,
}: ExecutionPlanNodeProps) {
  const {
    operation,
    detail,
    estimatedCost,
    estimatedRows,
    hasWarning,
    warningType,
    tableName,
    indexName,
  } = data;

  const Icon = getOperationIcon(operation);
  const warningStyle = warningType
    ? WARNING_COLORS[warningType]
    : WARNING_COLORS['full-scan'];

  return (
    <div
      className={cn(
        'bg-card text-card-foreground min-w-[280px] rounded-lg border shadow-sm',
        'dark:border-zinc-700 dark:bg-zinc-900',
        selected && 'ring-primary ring-2',
        hasWarning && [warningStyle.border, warningStyle.bg]
      )}
    >
      {/* Target handle (incoming connections from parent nodes) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !border-2 !border-primary !bg-primary"
      />

      {/* Header with operation type */}
      <div
        className={cn(
          'flex items-center gap-2 rounded-t-lg border-b px-3 py-2',
          'bg-muted/50 dark:bg-zinc-800/50',
          hasWarning && warningStyle.text
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate font-medium">{operation}</span>
        {hasWarning && (
          <AlertTriangle
            className={cn('ml-auto h-4 w-4 shrink-0', warningStyle.text)}
          />
        )}
      </div>

      {/* Body with details */}
      <div className="space-y-2 p-3">
        {/* Table/Index name */}
        {(tableName || indexName) && (
          <div className="flex items-center gap-2 text-sm">
            {tableName && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Table:</span>
                <span className="font-mono font-medium">{tableName}</span>
              </div>
            )}
            {indexName && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Index:</span>
                <span className="font-mono font-medium">{indexName}</span>
              </div>
            )}
          </div>
        )}

        {/* Detail text (truncated) */}
        <p
          className="text-muted-foreground line-clamp-2 font-mono text-xs"
          title={detail}
        >
          {detail}
        </p>

        {/* Metrics */}
        {(estimatedCost !== undefined || estimatedRows !== undefined) && (
          <div className="flex gap-3 border-t pt-2 text-xs">
            {estimatedCost !== undefined && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Cost:</span>
                <span className="font-medium">{estimatedCost}</span>
              </div>
            )}
            {estimatedRows !== undefined && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Rows:</span>
                <span className="font-medium">~{estimatedRows}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Source handle (outgoing connections to child nodes) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-2 !border-primary !bg-primary"
      />
    </div>
  );
}

export const ExecutionPlanNode = memo(ExecutionPlanNodeComponent);
