import type { QueryPlanNode, QueryPlanStats } from '../../../../shared/types';
import type { ColorMode } from '@xyflow/react';
import type {
  ExecutionPlanFlowEdge,
  ExecutionPlanFlowNode,
} from '@/lib/query-plan-analyzer';
import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock,
  Database,
  Download,
  FileText,
  HardDrive,
  LayoutList,
  Lightbulb,
  Loader2,
  Network,
  Search,
  Table,
  X,
  Zap,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { memo, useCallback, useMemo, useState } from 'react';
import {
  Background,
  Controls,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { SqlHighlight } from '@/components/ui/sql-highlight';
import { cn } from '@/lib/utils';
import { convertPlanToFlow, exportPlanAsText } from '@/lib/query-plan-analyzer';
import { ExecutionPlanNode as ExecutionPlanNodeComponent } from './ExecutionPlanNode';
import { exportDiagramAsPng } from '../er-diagram/utils/export-diagram';
import '@xyflow/react/dist/style.css';

// Register custom node types for execution plan
const nodeTypes = {
  executionPlan: ExecutionPlanNodeComponent,
};

interface Suggestion {
  type: 'index' | 'rewrite' | 'warning';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
}

type ViewMode = 'tree' | 'diagram';

interface QueryOptimizerPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query?: string;
  onAnalyze?: (query: string) => Promise<{
    plan: QueryPlanNode[];
    stats: QueryPlanStats;
    suggestions: Suggestion[];
  }>;
}

const OPERATION_ICONS: Record<string, React.ElementType> = {
  SCAN: Table,
  SEARCH: Search,
  INDEX: Zap,
  PRIMARY: HardDrive,
  default: Database,
};

const getOperationIcon = (detail: string): React.ElementType => {
  const upper = detail.toUpperCase();
  if (upper.includes('SCAN')) return OPERATION_ICONS.SCAN;
  if (upper.includes('SEARCH')) return OPERATION_ICONS.SEARCH;
  if (upper.includes('INDEX')) return OPERATION_ICONS.INDEX;
  if (upper.includes('PRIMARY')) return OPERATION_ICONS.PRIMARY;
  return OPERATION_ICONS.default;
};

interface PlanNodeProps {
  node: QueryPlanNode;
  depth: number;
  children?: QueryPlanNode[];
}

const PlanNode = memo(function PlanNode({
  node,
  depth,
  children = [],
}: PlanNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const Icon = getOperationIcon(node.detail);
  const hasChildren = children.length > 0;

  return (
    <div className="space-y-1">
      <div
        className={cn(
          'hover:bg-muted/50 flex items-center gap-2 rounded-md p-2 transition-colors',
          depth > 0 && 'ml-4 border-l pl-4'
        )}
        style={{ marginLeft: depth * 16 }}
      >
        {hasChildren ? (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="hover:bg-muted shrink-0 rounded p-0.5"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}
        <div className="bg-primary/10 rounded p-1">
          <Icon className="text-primary h-4 w-4" />
        </div>
        <div className="flex-1">
          <p className="font-mono text-sm">{node.detail}</p>
          {(node.estimatedCost || node.estimatedRows) && (
            <div className="text-muted-foreground flex gap-4 text-xs">
              {node.estimatedCost && <span>Cost: {node.estimatedCost}</span>}
              {node.estimatedRows && <span>Rows: ~{node.estimatedRows}</span>}
            </div>
          )}
        </div>
      </div>
      {isExpanded &&
        children.map((child) => (
          <PlanNode key={child.id} node={child} depth={depth + 1} />
        ))}
    </div>
  );
});

export const QueryOptimizerPanel = memo(
  ({ open, onOpenChange, query = '', onAnalyze }: QueryOptimizerPanelProps) => {
    const { resolvedTheme } = useTheme();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [plan, setPlan] = useState<QueryPlanNode[]>([]);
    const [stats, setStats] = useState<QueryPlanStats | null>(null);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('tree');
    const [selectedNode, setSelectedNode] =
      useState<ExecutionPlanFlowNode | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    const handleAnalyze = useCallback(async () => {
      if (!onAnalyze || !query.trim()) return;

      setIsAnalyzing(true);
      setError(null);

      try {
        const result = await onAnalyze(query);
        setPlan(result.plan);
        setStats(result.stats);
        setSuggestions(result.suggestions);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Analysis failed');
      } finally {
        setIsAnalyzing(false);
      }
    }, [onAnalyze, query]);

    // Build tree structure from flat plan
    const buildTree = (nodes: QueryPlanNode[]) => {
      const map = new Map<number, QueryPlanNode[]>();
      nodes.forEach((node) => {
        if (!map.has(node.parent)) {
          map.set(node.parent, []);
        }
        map.get(node.parent)!.push(node);
      });
      return map;
    };

    const tree = buildTree(plan);
    const rootNodes = tree.get(0) || [];

    // Convert plan to React Flow nodes and edges
    const { flowNodes, flowEdges } = useMemo(() => {
      if (plan.length === 0 || viewMode !== 'diagram') {
        return { flowNodes: [], flowEdges: [] };
      }
      const { nodes, edges } = convertPlanToFlow(plan);
      return { flowNodes: nodes, flowEdges: edges };
    }, [plan, viewMode]);

    const [nodes, setNodes, onNodesChange] =
      useNodesState<ExecutionPlanFlowNode>(flowNodes);
    const [edges, setEdges, onEdgesChange] =
      useEdgesState<ExecutionPlanFlowEdge>(flowEdges);

    // Update nodes when flow changes
    useMemo(() => {
      if (flowNodes.length > 0) {
        setNodes(flowNodes);
        setEdges(flowEdges);
      }
    }, [flowNodes, flowEdges, setNodes, setEdges]);

    // Handle node click - show detail panel
    const handleNodeClick = useCallback(
      (_event: React.MouseEvent, node: ExecutionPlanFlowNode) => {
        setSelectedNode(node);
      },
      []
    );

    // Handle PNG export
    const handleExportPng = useCallback(async () => {
      setIsExporting(true);
      try {
        const container = document.querySelector(
          '.query-optimizer-flow'
        ) as HTMLElement;

        if (!container) {
          return;
        }

        await exportDiagramAsPng(container, {
          filename: `query-execution-plan-${Date.now()}.png`,
        });
      } catch (error) {
        // Error is logged by exportDiagramAsPng
      } finally {
        setIsExporting(false);
      }
    }, []);

    // Handle text export
    const handleExportText = useCallback(() => {
      if (!stats || plan.length === 0) {
        return;
      }

      try {
        const textContent = exportPlanAsText(plan, stats, query);
        const blob = new Blob([textContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `query-execution-plan-${Date.now()}.txt`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        // Silent error handling
      }
    }, [plan, stats, query]);

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[80vh] max-w-3xl flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Query Optimizer
            </DialogTitle>
            <DialogDescription>
              Analyze query execution plan and get optimization suggestions.
            </DialogDescription>
          </DialogHeader>

          {/* Query Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Query</span>
              <Button
                size="sm"
                onClick={handleAnalyze}
                disabled={isAnalyzing || !query.trim()}
              >
                {isAnalyzing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                Analyze
              </Button>
            </div>
            {query ? (
              <SqlHighlight
                code={query}
                maxLines={3}
                className="bg-muted rounded-lg p-3 text-sm"
              />
            ) : (
              <pre className="bg-muted text-muted-foreground rounded-lg p-3 font-mono text-sm">
                No query to analyze
              </pre>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="border-destructive/50 bg-destructive/10 flex items-start gap-3 rounded-lg border p-4">
              <AlertCircle className="text-destructive h-5 w-5 shrink-0" />
              <div>
                <p className="text-destructive font-medium">Analysis Error</p>
                <p className="text-destructive/80 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Stats Summary */}
          {stats && (
            <div className="bg-muted/50 grid grid-cols-4 gap-4 rounded-lg p-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span className="text-lg font-bold">
                    {(stats.executionTime ?? 0).toFixed(2)}ms
                  </span>
                </div>
                <p className="text-muted-foreground text-xs">Execution Time</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold">{stats.rowsExamined ?? 0}</p>
                <p className="text-muted-foreground text-xs">Rows Examined</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold">{stats.rowsReturned ?? 0}</p>
                <p className="text-muted-foreground text-xs">Rows Returned</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold">
                  {stats.indexesUsed?.length ?? 0}
                </p>
                <p className="text-muted-foreground text-xs">Indexes Used</p>
              </div>
            </div>
          )}

          {/* Execution Plan Tree */}
          {plan.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Execution Plan</h3>
                <div className="flex gap-1">
                  <Button
                    variant={viewMode === 'tree' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('tree')}
                    className="h-8 px-2"
                  >
                    <LayoutList className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'diagram' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('diagram')}
                    className="h-8 px-2"
                  >
                    <Network className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleExportText}
                    disabled={!stats || plan.length === 0}
                    className="h-8 px-2"
                    title="Export as Text"
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                  {viewMode === 'diagram' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleExportPng}
                      disabled={isExporting}
                      className="h-8 px-2"
                      title="Export as PNG"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {viewMode === 'tree' && (
                <ScrollArea className="bg-muted/30 h-48 rounded-lg border p-2">
                  {rootNodes.map((node) => (
                    <PlanNode
                      key={node.id}
                      node={node}
                      depth={0}
                      children={tree.get(node.id)}
                    />
                  ))}
                </ScrollArea>
              )}

              {viewMode === 'diagram' && (
                <div className="bg-muted/30 query-optimizer-flow h-96 rounded-lg border">
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onNodeClick={handleNodeClick}
                    nodeTypes={nodeTypes}
                    colorMode={resolvedTheme as ColorMode}
                    fitView
                    fitViewOptions={{ padding: 0.2 }}
                    minZoom={0.1}
                    maxZoom={2}
                    proOptions={{ hideAttribution: true }}
                  >
                    <Background />
                    <Controls showInteractive={false} />
                  </ReactFlow>
                </div>
              )}
            </div>
          )}

          {/* Optimization Suggestions */}
          {suggestions.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium">Suggestions</h3>
              <ScrollArea className="max-h-48">
                <div className="space-y-2">
                  {suggestions.map((suggestion) => (
                    <div
                      key={`${suggestion.type}-${suggestion.title}`}
                      className={cn(
                        'flex items-start gap-3 rounded-lg border p-3',
                        suggestion.type === 'warning' &&
                          'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950',
                        suggestion.type === 'index' &&
                          'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950',
                        suggestion.type === 'rewrite' &&
                          'border-purple-200 bg-purple-50 dark:border-purple-900 dark:bg-purple-950'
                      )}
                    >
                      <Lightbulb
                        className={cn(
                          'h-5 w-5 shrink-0',
                          suggestion.type === 'warning' && 'text-amber-600',
                          suggestion.type === 'index' && 'text-blue-600',
                          suggestion.type === 'rewrite' && 'text-purple-600'
                        )}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{suggestion.title}</p>
                          <Badge
                            variant={
                              suggestion.impact === 'high'
                                ? 'destructive'
                                : suggestion.impact === 'medium'
                                  ? 'default'
                                  : 'secondary'
                            }
                            className="text-xs"
                          >
                            {suggestion.impact} impact
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-sm">
                          {suggestion.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Empty State */}
          {!isAnalyzing && plan.length === 0 && !error && (
            <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center py-12">
              <Zap className="mb-4 h-12 w-12 opacity-30" />
              <p className="text-lg font-medium">Ready to Analyze</p>
              <p className="text-sm">
                Click Analyze to see the query execution plan
              </p>
            </div>
          )}
        </DialogContent>

        {/* Node Detail Panel */}
        <Sheet
          open={!!selectedNode}
          onOpenChange={(open) => !open && setSelectedNode(null)}
        >
          <SheetContent className="w-[400px] sm:w-[540px]">
            {selectedNode && (
              <>
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    {selectedNode.data.hasWarning && (
                      <AlertTriangle className="text-amber-600 h-5 w-5" />
                    )}
                    {selectedNode.data.operation}
                  </SheetTitle>
                  <SheetDescription>
                    Execution plan node details
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                  {/* Operation Details */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Operation</h3>
                    <div className="bg-muted rounded-lg p-3">
                      <p className="font-mono text-sm">
                        {selectedNode.data.detail}
                      </p>
                    </div>
                  </div>

                  {/* Table/Index Info */}
                  {(selectedNode.data.tableName ||
                    selectedNode.data.indexName) && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">
                        Table &amp; Index
                      </h3>
                      <div className="space-y-2">
                        {selectedNode.data.tableName && (
                          <div className="flex items-center gap-2">
                            <Table className="text-muted-foreground h-4 w-4" />
                            <span className="text-muted-foreground text-sm">
                              Table:
                            </span>
                            <span className="font-mono text-sm font-medium">
                              {selectedNode.data.tableName}
                            </span>
                          </div>
                        )}
                        {selectedNode.data.indexName && (
                          <div className="flex items-center gap-2">
                            <Zap className="text-muted-foreground h-4 w-4" />
                            <span className="text-muted-foreground text-sm">
                              Index:
                            </span>
                            <span className="font-mono text-sm font-medium">
                              {selectedNode.data.indexName}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Performance Metrics */}
                  {(selectedNode.data.estimatedCost !== undefined ||
                    selectedNode.data.estimatedRows !== undefined) && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">
                        Performance Metrics
                      </h3>
                      <div className="bg-muted/50 grid grid-cols-2 gap-4 rounded-lg p-4">
                        {selectedNode.data.estimatedCost !== undefined && (
                          <div className="text-center">
                            <p className="text-2xl font-bold">
                              {selectedNode.data.estimatedCost}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              Estimated Cost
                            </p>
                          </div>
                        )}
                        {selectedNode.data.estimatedRows !== undefined && (
                          <div className="text-center">
                            <p className="text-2xl font-bold">
                              ~{selectedNode.data.estimatedRows}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              Estimated Rows
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Warnings */}
                  {selectedNode.data.hasWarning && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">Performance Warning</h3>
                      <div
                        className={cn(
                          'flex items-start gap-3 rounded-lg border p-4',
                          selectedNode.data.warningType === 'full-scan' &&
                            'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30',
                          selectedNode.data.warningType === 'temp-btree' &&
                            'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30',
                          selectedNode.data.warningType === 'subquery' &&
                            'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30',
                          selectedNode.data.warningType === 'missing-index' &&
                            'border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/30'
                        )}
                      >
                        <AlertTriangle
                          className={cn(
                            'h-5 w-5 shrink-0',
                            selectedNode.data.warningType === 'full-scan' &&
                              'text-red-600 dark:text-red-400',
                            selectedNode.data.warningType === 'temp-btree' &&
                              'text-amber-600 dark:text-amber-400',
                            selectedNode.data.warningType === 'subquery' &&
                              'text-blue-600 dark:text-blue-400',
                            selectedNode.data.warningType === 'missing-index' &&
                              'text-orange-600 dark:text-orange-400'
                          )}
                        />
                        <div className="flex-1 space-y-1">
                          <p className="font-medium">
                            {selectedNode.data.warningType === 'full-scan' &&
                              'Full Table Scan'}
                            {selectedNode.data.warningType === 'temp-btree' &&
                              'Temporary B-Tree'}
                            {selectedNode.data.warningType === 'subquery' &&
                              'Subquery Operation'}
                            {selectedNode.data.warningType === 'missing-index' &&
                              'Missing Index'}
                          </p>
                          <p className="text-muted-foreground text-sm">
                            {selectedNode.data.warningType === 'full-scan' &&
                              'This operation scans all rows in the table. Consider adding an index to improve performance.'}
                            {selectedNode.data.warningType === 'temp-btree' &&
                              'A temporary structure is created for sorting. Adding an index on sort columns may help.'}
                            {selectedNode.data.warningType === 'subquery' &&
                              'Subqueries can be expensive. Consider rewriting as a JOIN if possible.'}
                            {selectedNode.data.warningType === 'missing-index' &&
                              'An index could improve performance for this operation.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <SheetClose className="absolute right-4 top-4">
                  <Button variant="ghost" size="icon">
                    <X className="h-4 w-4" />
                  </Button>
                </SheetClose>
              </>
            )}
          </SheetContent>
        </Sheet>
      </Dialog>
    );
  }
);
