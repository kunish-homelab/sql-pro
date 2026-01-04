import type { ColumnInfo, DataInsight } from '@shared/types';
import { Badge } from '@sqlpro/ui/badge';
import { Button } from '@sqlpro/ui/button';
import { ScrollArea } from '@sqlpro/ui/scroll-area';
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Info,
  Lightbulb,
  Loader2,
  Settings2,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { memo, useState } from 'react';
import { SettingsDialog } from '@/components/SettingsDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDataAnalysis } from '@/hooks/useAI';
import { cn } from '@/lib/utils';

interface DataAnalysisPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
}

const INSIGHT_ICONS: Partial<Record<DataInsight['type'], React.ElementType>> = {
  anomaly: AlertTriangle,
  suggestion: Lightbulb,
  pattern: TrendingUp,
  trend: TrendingUp,
  summary: Lightbulb,
};

const SEVERITY_STYLES: Record<string, string> = {
  info: 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950',
  warning:
    'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950',
  error: 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950',
  low: 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950',
  medium:
    'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950',
  high: 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950',
};

const SEVERITY_ICON_STYLES: Record<string, string> = {
  info: 'text-blue-600',
  warning: 'text-amber-600',
  error: 'text-red-600',
  low: 'text-blue-600',
  medium: 'text-amber-600',
  high: 'text-red-600',
};

export const DataAnalysisPanel = memo(
  ({ open, onOpenChange, columns, rows }: DataAnalysisPanelProps) => {
    const [showSettings, setShowSettings] = useState(false);

    const { analyzeData, insights, summary, isAnalyzing, error, isConfigured } =
      useDataAnalysis();

    const handleAnalyze = async () => {
      await analyzeData(columns, rows);
    };

    const anomalies = insights.filter((i) => i.type === 'anomaly');
    const suggestions = insights.filter((i) => i.type === 'suggestion');
    const patterns = insights.filter((i) => i.type === 'pattern');

    return (
      <>
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="flex max-h-[80vh] max-w-2xl flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                AI Data Analysis
              </DialogTitle>
              <DialogDescription>
                Use AI to detect anomalies, identify patterns, and get
                intelligent suggestions about your data.
              </DialogDescription>
            </DialogHeader>

            {/* Configuration Warning */}
            {!isConfigured && (
              <div className="bg-warning/10 border-warning/50 flex items-start gap-3 rounded-lg border p-3">
                <AlertCircle className="text-warning mt-0.5 h-5 w-5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">AI not configured</p>
                  <p className="text-muted-foreground text-xs">
                    Please configure your AI provider to use data analysis.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSettings(true)}
                >
                  <Settings2 className="mr-1 h-3 w-3" />
                  Configure
                </Button>
              </div>
            )}

            {/* Data Info */}
            <div className="bg-muted/50 flex items-center justify-between rounded-lg p-3">
              <div className="text-sm">
                <span className="text-muted-foreground">Analyzing </span>
                <span className="font-medium">{rows.length} rows</span>
                <span className="text-muted-foreground"> across </span>
                <span className="font-medium">{columns.length} columns</span>
              </div>
              <Button
                size="sm"
                onClick={handleAnalyze}
                disabled={isAnalyzing || !isConfigured || rows.length === 0}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Analyze Data
                  </>
                )}
              </Button>
            </div>

            {/* Error */}
            {error && (
              <div className="border-destructive/50 bg-destructive/10 flex items-start gap-3 rounded-lg border p-3">
                <AlertCircle className="text-destructive h-5 w-5 shrink-0" />
                <div>
                  <p className="text-destructive text-sm font-medium">
                    Analysis Error
                  </p>
                  <p className="text-destructive/80 text-xs">{error}</p>
                </div>
              </div>
            )}

            {/* Summary */}
            {summary && (
              <div className="bg-primary/5 border-primary/20 rounded-lg border p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Info className="text-primary h-4 w-4" />
                  <span className="text-sm font-medium">Summary</span>
                </div>
                <p className="text-muted-foreground text-sm">{summary}</p>
              </div>
            )}

            {/* Insights */}
            {insights.length > 0 && (
              <div className="flex-1 space-y-4 overflow-hidden">
                {/* Stats Bar */}
                <div className="flex gap-4">
                  <Badge variant="outline" className="gap-1">
                    <AlertTriangle className="h-3 w-3 text-amber-600" />
                    {anomalies.length} Anomalies
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Lightbulb className="h-3 w-3 text-blue-600" />
                    {suggestions.length} Suggestions
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <TrendingUp className="h-3 w-3 text-green-600" />
                    {patterns.length} Patterns
                  </Badge>
                </div>

                {/* Insights List */}
                <ScrollArea className="h-75">
                  <div className="space-y-2 pr-4">
                    {insights.map((insight) => {
                      const Icon = INSIGHT_ICONS[insight.type] || Lightbulb;
                      const insightKey = `${insight.type}-${insight.column || 'general'}-${(insight.message || '').slice(0, 20)}`;
                      const severity = insight.severity || 'info';
                      return (
                        <div
                          key={insightKey}
                          className={cn(
                            'flex items-start gap-3 rounded-lg border p-3',
                            SEVERITY_STYLES[severity]
                          )}
                        >
                          <Icon
                            className={cn(
                              'mt-0.5 h-4 w-4 shrink-0',
                              SEVERITY_ICON_STYLES[severity]
                            )}
                          />
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              {insight.column && (
                                <Badge variant="secondary" className="text-xs">
                                  {insight.column}
                                </Badge>
                              )}
                              <Badge
                                variant={
                                  insight.severity === 'error'
                                    ? 'destructive'
                                    : insight.severity === 'warning'
                                      ? 'default'
                                      : 'secondary'
                                }
                                className="text-xs capitalize"
                              >
                                {insight.type}
                              </Badge>
                            </div>
                            <p className="text-sm">{insight.message}</p>
                            {insight.details && (
                              <pre className="bg-background/50 mt-2 overflow-x-auto rounded p-2 font-mono text-xs">
                                {JSON.stringify(insight.details, null, 2)}
                              </pre>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Empty State */}
            {!isAnalyzing && insights.length === 0 && !error && (
              <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center py-12">
                <BarChart3 className="mb-4 h-12 w-12 opacity-30" />
                <p className="text-lg font-medium">Ready to Analyze</p>
                <p className="text-center text-sm">
                  Click Analyze Data to detect anomalies,
                  <br />
                  identify patterns, and get suggestions.
                </p>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Settings Dialog */}
        <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
      </>
    );
  }
);
