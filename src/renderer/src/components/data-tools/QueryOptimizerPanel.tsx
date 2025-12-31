import type { QueryPlanNode, QueryPlanStats } from '../../../../shared/types';
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Database,
  HardDrive,
  Lightbulb,
  Loader2,
  Search,
  Table,
  Zap,
} from 'lucide-react';
import { memo, useCallback, useState } from 'react';
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
import { SqlHighlight } from '@/components/ui/sql-highlight';
import { cn } from '@/lib/utils';

interface Suggestion {
  type: 'index' | 'rewrite' | 'warning';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
}

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
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [plan, setPlan] = useState<QueryPlanNode[]>([]);
    const [stats, setStats] = useState<QueryPlanStats | null>(null);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [error, setError] = useState<string | null>(null);

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
              <h3 className="font-medium">Execution Plan</h3>
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
      </Dialog>
    );
  }
);
