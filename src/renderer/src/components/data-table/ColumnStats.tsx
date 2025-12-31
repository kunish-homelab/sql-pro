import type { ColumnSchema } from '@/types/database';
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  Hash,
  Percent,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface ColumnStatsProps {
  columns: ColumnSchema[];
  data: Record<string, unknown>[];
  className?: string;
}

interface ColumnStat {
  column: string;
  type: string;
  totalCount: number;
  nullCount: number;
  distinctCount: number;
  /** For numeric columns */
  min?: number;
  max?: number;
  avg?: number;
  sum?: number;
  /** For text columns */
  minLength?: number;
  maxLength?: number;
  avgLength?: number;
  /** Most common values */
  topValues: Array<{ value: unknown; count: number; percentage: number }>;
}

/**
 * Calculate statistics for a single column
 */
function calculateColumnStats(
  columnName: string,
  columnType: string,
  data: Record<string, unknown>[]
): ColumnStat {
  const values = data.map((row) => row[columnName]);
  const totalCount = values.length;
  const nullCount = values.filter((v) => v === null || v === undefined).length;
  const nonNullValues = values.filter((v) => v !== null && v !== undefined);

  // Count distinct values
  const valueSet = new Set(nonNullValues.map((v) => JSON.stringify(v)));
  const distinctCount = valueSet.size;

  // Count value frequencies for top values
  const valueCounts = new Map<string, { value: unknown; count: number }>();
  for (const value of nonNullValues) {
    const key = JSON.stringify(value);
    const existing = valueCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      valueCounts.set(key, { value, count: 1 });
    }
  }

  // Sort by count and take top 5
  const sortedValues = Array.from(valueCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((v) => ({
      value: v.value,
      count: v.count,
      percentage: totalCount > 0 ? (v.count / totalCount) * 100 : 0,
    }));

  const stat: ColumnStat = {
    column: columnName,
    type: columnType,
    totalCount,
    nullCount,
    distinctCount,
    topValues: sortedValues,
  };

  // Numeric statistics
  const typeLower = columnType.toLowerCase();
  if (
    typeLower.includes('int') ||
    typeLower.includes('num') ||
    typeLower.includes('float') ||
    typeLower.includes('real') ||
    typeLower.includes('double')
  ) {
    const numbers = nonNullValues
      .map((v) => Number(v))
      .filter((n) => !Number.isNaN(n));

    if (numbers.length > 0) {
      stat.min = Math.min(...numbers);
      stat.max = Math.max(...numbers);
      stat.sum = numbers.reduce((a, b) => a + b, 0);
      stat.avg = stat.sum / numbers.length;
    }
  }

  // Text statistics
  if (
    typeLower.includes('text') ||
    typeLower.includes('char') ||
    typeLower.includes('varchar')
  ) {
    const lengths = nonNullValues.map((v) => String(v).length);

    if (lengths.length > 0) {
      stat.minLength = Math.min(...lengths);
      stat.maxLength = Math.max(...lengths);
      stat.avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    }
  }

  return stat;
}

/**
 * A collapsible panel that shows column statistics.
 * Displays min, max, avg, distinct values, null count, and top values.
 */
export const ColumnStats = memo(
  ({ columns, data, className }: ColumnStatsProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedColumn, setSelectedColumn] = useState<string | null>(null);

    // Calculate stats for all columns
    const stats = useMemo(() => {
      if (data.length === 0) return [];

      return columns.map((col) =>
        calculateColumnStats(col.name, col.type, data)
      );
    }, [columns, data]);

    // Get selected column stats
    const selectedStats = useMemo(() => {
      if (!selectedColumn) return null;
      return stats.find((s) => s.column === selectedColumn);
    }, [stats, selectedColumn]);

    if (data.length === 0) return null;

    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-8 w-full justify-between rounded-none border-t px-4',
              'hover:bg-muted/50 transition-all duration-200',
              className
            )}
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="text-muted-foreground h-3.5 w-3.5" />
              <span className="text-xs font-medium">Column Statistics</span>
              <span className="text-muted-foreground text-[10px]">
                ({columns.length} columns, {data.length} rows)
              </span>
            </div>
            {isOpen ? (
              <ChevronDown className="text-muted-foreground h-3.5 w-3.5 transition-transform" />
            ) : (
              <ChevronUp className="text-muted-foreground h-3.5 w-3.5 transition-transform" />
            )}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="animate-in slide-in-from-top-2 duration-200">
          <div className="bg-muted/30 border-t">
            {/* Column selector */}
            <div className="flex gap-1 overflow-x-auto border-b p-2">
              {columns.map((col) => {
                const stat = stats.find((s) => s.column === col.name);
                const isSelected = selectedColumn === col.name;
                const nullPercentage = stat
                  ? (stat.nullCount / stat.totalCount) * 100
                  : 0;

                return (
                  <button
                    key={col.name}
                    onClick={() =>
                      setSelectedColumn(isSelected ? null : col.name)
                    }
                    className={cn(
                      'flex items-center gap-1.5 rounded px-2 py-1 text-xs',
                      'whitespace-nowrap transition-all duration-150',
                      isSelected
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'hover:bg-muted bg-background border'
                    )}
                  >
                    <span className="max-w-[100px] truncate font-medium">
                      {col.name}
                    </span>
                    {nullPercentage > 0 && (
                      <span
                        className={cn(
                          'rounded px-1 text-[9px]',
                          isSelected
                            ? 'bg-primary-foreground/20'
                            : nullPercentage > 50
                              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                              : 'bg-muted'
                        )}
                      >
                        {nullPercentage.toFixed(0)}% null
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Stats display */}
            {selectedStats ? (
              <div className="animate-in fade-in space-y-3 p-3 duration-200">
                {/* Quick stats row */}
                <div className="grid grid-cols-4 gap-3">
                  <StatCard
                    icon={<Hash className="h-3 w-3" />}
                    label="Distinct"
                    value={selectedStats.distinctCount.toLocaleString()}
                    subtitle={`of ${selectedStats.totalCount.toLocaleString()}`}
                  />
                  <StatCard
                    icon={<Percent className="h-3 w-3" />}
                    label="Null Rate"
                    value={`${((selectedStats.nullCount / selectedStats.totalCount) * 100).toFixed(1)}%`}
                    subtitle={`${selectedStats.nullCount} nulls`}
                    warning={
                      selectedStats.nullCount / selectedStats.totalCount > 0.5
                    }
                  />
                  {selectedStats.min !== undefined && (
                    <StatCard
                      icon={<TrendingDown className="h-3 w-3" />}
                      label="Min"
                      value={formatNumber(selectedStats.min)}
                    />
                  )}
                  {selectedStats.max !== undefined && (
                    <StatCard
                      icon={<TrendingUp className="h-3 w-3" />}
                      label="Max"
                      value={formatNumber(selectedStats.max)}
                    />
                  )}
                  {selectedStats.avg !== undefined && (
                    <StatCard
                      icon={<Sparkles className="h-3 w-3" />}
                      label="Average"
                      value={formatNumber(selectedStats.avg)}
                    />
                  )}
                  {selectedStats.avgLength !== undefined && (
                    <StatCard
                      icon={<Sparkles className="h-3 w-3" />}
                      label="Avg Length"
                      value={selectedStats.avgLength.toFixed(1)}
                      subtitle={`${selectedStats.minLength}-${selectedStats.maxLength}`}
                    />
                  )}
                </div>

                {/* Top values */}
                {selectedStats.topValues.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-muted-foreground text-[10px] font-medium uppercase">
                      Top Values
                    </span>
                    <div className="space-y-1">
                      {selectedStats.topValues.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate font-mono">
                                {formatValue(item.value)}
                              </span>
                              <span className="text-muted-foreground shrink-0">
                                ({item.count})
                              </span>
                            </div>
                            <Progress
                              value={item.percentage}
                              className="mt-0.5 h-1"
                            />
                          </div>
                          <span className="text-muted-foreground w-12 text-right text-[10px]">
                            {item.percentage.toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-muted-foreground p-4 text-center text-xs">
                Select a column above to view detailed statistics
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }
);

ColumnStats.displayName = 'ColumnStats';

// Helper components

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  warning?: boolean;
}

function StatCard({ icon, label, value, subtitle, warning }: StatCardProps) {
  return (
    <div
      className={cn(
        'bg-background rounded-md border px-2.5 py-1.5',
        warning && 'border-amber-500/50 bg-amber-500/5'
      )}
    >
      <div className="text-muted-foreground mb-0.5 flex items-center gap-1">
        {icon}
        <span className="text-[10px] uppercase">{label}</span>
      </div>
      <div className="text-sm font-medium">{value}</div>
      {subtitle && (
        <div className="text-muted-foreground text-[10px]">{subtitle}</div>
      )}
    </div>
  );
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) {
    return n.toLocaleString();
  }
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  const str = String(value);
  return str.length > 30 ? `${str.slice(0, 30)}...` : str;
}
