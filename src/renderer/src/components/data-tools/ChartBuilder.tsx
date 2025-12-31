import type { QueryResult } from '@/types/database';
import { BarChart3, LineChart, PieChart, Plus, TrendingUp } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type ChartType = 'bar' | 'line' | 'pie' | 'area';

interface ChartConfig {
  id: string;
  type: ChartType;
  title: string;
  xAxis: string;
  yAxis: string;
  aggregation: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'none';
  colorScheme: string;
}

interface ChartBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  results?: QueryResult;
  onCreateChart?: (config: ChartConfig) => void;
}

const CHART_TYPES: {
  type: ChartType;
  icon: React.ElementType;
  label: string;
}[] = [
  { type: 'bar', icon: BarChart3, label: 'Bar Chart' },
  { type: 'line', icon: LineChart, label: 'Line Chart' },
  { type: 'pie', icon: PieChart, label: 'Pie Chart' },
  { type: 'area', icon: TrendingUp, label: 'Area Chart' },
];

const AGGREGATIONS = [
  { value: 'none', label: 'None (Raw Values)' },
  { value: 'count', label: 'Count' },
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
];

const COLOR_SCHEMES = [
  {
    value: 'default',
    label: 'Default',
    colors: ['#3b82f6', '#10b981', '#f59e0b'],
  },
  { value: 'cool', label: 'Cool', colors: ['#06b6d4', '#3b82f6', '#8b5cf6'] },
  { value: 'warm', label: 'Warm', colors: ['#f97316', '#ef4444', '#ec4899'] },
  {
    value: 'mono',
    label: 'Monochrome',
    colors: ['#374151', '#6b7280', '#9ca3af'],
  },
];

const generateId = () =>
  `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

interface ChartPreviewProps {
  config: ChartConfig;
  data: { label: string; value: number }[];
}

const ChartPreview = memo(({ config, data }: ChartPreviewProps) => {
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const colors =
    COLOR_SCHEMES.find((s) => s.value === config.colorScheme)?.colors ||
    COLOR_SCHEMES[0].colors;

  if (config.type === 'pie') {
    const total = data.reduce((acc, d) => acc + d.value, 0);
    let currentAngle = 0;

    return (
      <div className="flex items-center justify-center py-4">
        <svg viewBox="0 0 100 100" className="h-48 w-48">
          {data.map((d, i) => {
            const percentage = d.value / total;
            const angle = percentage * 360;
            const startAngle = currentAngle;
            currentAngle += angle;

            const startRad = ((startAngle - 90) * Math.PI) / 180;
            const endRad = ((currentAngle - 90) * Math.PI) / 180;

            const x1 = 50 + 40 * Math.cos(startRad);
            const y1 = 50 + 40 * Math.sin(startRad);
            const x2 = 50 + 40 * Math.cos(endRad);
            const y2 = 50 + 40 * Math.sin(endRad);

            const largeArc = angle > 180 ? 1 : 0;

            return (
              <path
                key={`slice-${d.label}-${d.value}`}
                d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`}
                fill={colors[i % colors.length]}
                className="transition-opacity hover:opacity-80"
              />
            );
          })}
        </svg>
        <div className="ml-4 space-y-1">
          {data.slice(0, 5).map((d, idx) => (
            <div
              key={`legend-${d.label}`}
              className="flex items-center gap-2 text-sm"
            >
              <div
                className="h-3 w-3 rounded"
                style={{ backgroundColor: colors[idx % colors.length] }}
              />
              <span className="truncate">{d.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-48 items-end gap-1 px-4 py-2">
      {data.slice(0, 12).map((d, idx) => {
        const height = (d.value / maxValue) * 100;
        return (
          <div
            key={`bar-${d.label}`}
            className="group relative flex flex-1 flex-col items-center"
          >
            <div
              className={cn(
                'w-full transition-all duration-200',
                config.type === 'line'
                  ? 'rounded-full'
                  : 'rounded-t-sm group-hover:opacity-80'
              )}
              style={{
                height: `${height}%`,
                backgroundColor: colors[idx % colors.length],
                minHeight: '4px',
              }}
            />
            <span className="text-muted-foreground mt-1 max-w-full truncate text-[10px]">
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
});

export const ChartBuilder = memo(
  ({ open, onOpenChange, results, onCreateChart }: ChartBuilderProps) => {
    const [config, setConfig] = useState<ChartConfig>(() => ({
      id: generateId(),
      type: 'bar',
      title: '',
      xAxis: '',
      yAxis: '',
      aggregation: 'count',
      colorScheme: 'default',
    }));

    const columns = useMemo(() => {
      if (!results?.columns) return [];
      return results.columns;
    }, [results?.columns]);

    // Auto-detect numeric columns for Y-axis
    const numericColumns = useMemo(() => {
      if (!results?.columns || !results?.rows?.length) return [];
      return results.columns.filter((col) => {
        const firstValue = results.rows[0]?.[col];
        return typeof firstValue === 'number';
      });
    }, [results?.columns, results?.rows]);

    // Generate preview data based on config
    const previewData = useMemo(() => {
      if (!results?.rows?.length || !config.xAxis) return [];

      const grouped = new Map<string, number[]>();

      for (const row of results.rows.slice(0, 100)) {
        const key = String(row[config.xAxis] ?? 'null');
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        if (config.yAxis && row[config.yAxis] !== undefined) {
          grouped.get(key)!.push(Number(row[config.yAxis]) || 0);
        } else {
          grouped.get(key)!.push(1);
        }
      }

      const data: { label: string; value: number }[] = [];
      grouped.forEach((values, label) => {
        let value: number;
        switch (config.aggregation) {
          case 'sum':
            value = values.reduce((a, b) => a + b, 0);
            break;
          case 'avg':
            value = values.reduce((a, b) => a + b, 0) / values.length;
            break;
          case 'min':
            value = Math.min(...values);
            break;
          case 'max':
            value = Math.max(...values);
            break;
          case 'count':
          default:
            value = values.length;
        }
        data.push({ label, value });
      });

      return data.sort((a, b) => b.value - a.value);
    }, [results?.rows, config.xAxis, config.yAxis, config.aggregation]);

    const handleCreate = useCallback(() => {
      if (onCreateChart && config.xAxis) {
        onCreateChart({
          ...config,
          id: generateId(),
          title:
            config.title || `${config.xAxis} by ${config.yAxis || 'Count'}`,
        });
        onOpenChange(false);
      }
    }, [config, onCreateChart, onOpenChange]);

    const canCreate =
      config.xAxis && (config.yAxis || config.aggregation === 'count');

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Create Chart
            </DialogTitle>
            <DialogDescription>
              Visualize your query results with interactive charts.
            </DialogDescription>
          </DialogHeader>

          {!results?.rows?.length ? (
            <div className="text-muted-foreground flex flex-col items-center justify-center py-12">
              <BarChart3 className="mb-4 h-12 w-12 opacity-30" />
              <p className="text-lg font-medium">No Data Available</p>
              <p className="text-sm">Execute a query first to create charts</p>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Configuration */}
              <div className="space-y-4">
                {/* Chart Type */}
                <div className="space-y-2">
                  <Label>Chart Type</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {CHART_TYPES.map(({ type, icon: Icon, label }) => (
                      <button
                        key={type}
                        onClick={() => setConfig({ ...config, type })}
                        className={cn(
                          'flex flex-col items-center gap-1 rounded-lg border p-3 transition-colors',
                          config.type === type
                            ? 'border-primary bg-primary/5'
                            : 'hover:border-primary/50'
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="text-xs">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="title">Chart Title</Label>
                  <Input
                    id="title"
                    value={config.title}
                    onChange={(e) =>
                      setConfig({ ...config, title: e.target.value })
                    }
                    placeholder="My Chart"
                  />
                </div>

                {/* X-Axis */}
                <div className="space-y-2">
                  <Label>X-Axis (Category)</Label>
                  <Select
                    value={config.xAxis}
                    onValueChange={(v) =>
                      v && setConfig({ ...config, xAxis: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column..." />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map((col) => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Y-Axis */}
                <div className="space-y-2">
                  <Label>Y-Axis (Value)</Label>
                  <Select
                    value={config.yAxis}
                    onValueChange={(v) =>
                      v && setConfig({ ...config, yAxis: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Use aggregation only</SelectItem>
                      {numericColumns.map((col) => (
                        <SelectItem key={col} value={col}>
                          {col}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Aggregation */}
                <div className="space-y-2">
                  <Label>Aggregation</Label>
                  <Select
                    value={config.aggregation}
                    onValueChange={(v) =>
                      v &&
                      setConfig({
                        ...config,
                        aggregation: v as ChartConfig['aggregation'],
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AGGREGATIONS.map((agg) => (
                        <SelectItem key={agg.value} value={agg.value}>
                          {agg.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Color Scheme */}
                <div className="space-y-2">
                  <Label>Color Scheme</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {COLOR_SCHEMES.map((scheme) => (
                      <button
                        key={scheme.value}
                        onClick={() =>
                          setConfig({ ...config, colorScheme: scheme.value })
                        }
                        className={cn(
                          'flex flex-col items-center gap-1 rounded-lg border p-2 transition-colors',
                          config.colorScheme === scheme.value
                            ? 'border-primary bg-primary/5'
                            : 'hover:border-primary/50'
                        )}
                      >
                        <div className="flex gap-0.5">
                          {scheme.colors.map((color) => (
                            <div
                              key={color}
                              className="h-4 w-4 rounded"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                        <span className="text-xs">{scheme.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <Label>Preview</Label>
                <div className="bg-muted/30 flex min-h-[300px] flex-col rounded-lg border">
                  {previewData.length > 0 ? (
                    <>
                      <div className="border-b px-4 py-2 text-center font-medium">
                        {config.title || 'Chart Preview'}
                      </div>
                      <div className="flex-1">
                        <ChartPreview config={config} data={previewData} />
                      </div>
                      <div className="text-muted-foreground border-t px-4 py-2 text-center text-xs">
                        Showing {previewData.length} data points
                      </div>
                    </>
                  ) : (
                    <div className="text-muted-foreground flex flex-1 items-center justify-center">
                      Select X-axis column to see preview
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!canCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Create Chart
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);
