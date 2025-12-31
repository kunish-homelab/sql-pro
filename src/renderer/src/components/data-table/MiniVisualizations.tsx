import { memo, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

/**
 * A mini sparkline chart for visualizing numeric trends
 */
export const Sparkline = memo(
  ({
    values,
    width = 60,
    height = 16,
    color = 'currentColor',
    className,
  }: SparklineProps) => {
    // Calculate the SVG path
    const path = useMemo(() => {
      if (values.length < 2) return null;

      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min || 1;

      const points = values.map((v, i) => {
        const x = (i / (values.length - 1)) * width;
        const y = height - ((v - min) / range) * (height - 2) - 1;
        return `${x},${y}`;
      });

      return `M ${points.join(' L ')}`;
    }, [values, width, height]);

    if (!path) return null;

    return (
      <svg
        width={width}
        height={height}
        className={cn('inline-block', className)}
        viewBox={`0 0 ${width} ${height}`}
      >
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
);

Sparkline.displayName = 'Sparkline';

interface MiniBarChartProps {
  value: number;
  max: number;
  className?: string;
  color?: 'default' | 'success' | 'warning' | 'danger';
}

/**
 * A mini horizontal bar for visualizing a single value relative to max
 */
export const MiniBar = memo(
  ({ value, max, className, color = 'default' }: MiniBarChartProps) => {
    const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;

    const colorClasses = {
      default: 'bg-primary',
      success: 'bg-green-500',
      warning: 'bg-amber-500',
      danger: 'bg-red-500',
    };

    return (
      <div
        className={cn(
          'bg-muted h-1.5 w-full overflow-hidden rounded-full',
          className
        )}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            colorClasses[color]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    );
  }
);

MiniBar.displayName = 'MiniBar';

interface DataDistributionProps {
  values: unknown[];
  type: string;
  className?: string;
}

/**
 * Shows a mini visualization of data distribution
 */
export const DataDistribution = memo(
  ({ values, type, className }: DataDistributionProps) => {
    // Determine visualization type based on data
    const visualization = useMemo(() => {
      const typeLower = type.toLowerCase();

      // For numeric types, show sparkline
      if (
        typeLower.includes('int') ||
        typeLower.includes('num') ||
        typeLower.includes('float') ||
        typeLower.includes('real') ||
        typeLower.includes('double')
      ) {
        const numbers = values
          .filter((v) => v !== null && v !== undefined)
          .map((v) => Number(v))
          .filter((n) => !Number.isNaN(n));

        if (numbers.length >= 3) {
          return { type: 'sparkline' as const, data: numbers };
        }
      }

      // For all types, show value distribution bars
      const counts = new Map<string, number>();
      let nullCount = 0;

      for (const v of values) {
        if (v === null || v === undefined) {
          nullCount++;
        } else {
          const key = String(v);
          counts.set(key, (counts.get(key) || 0) + 1);
        }
      }

      const sorted = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      return {
        type: 'distribution' as const,
        data: sorted,
        total: values.length,
        nullCount,
      };
    }, [values, type]);

    if (visualization.type === 'sparkline') {
      return (
        <div className={cn('flex items-center gap-1', className)}>
          <Sparkline
            values={visualization.data}
            width={40}
            height={12}
            color="hsl(var(--primary))"
          />
        </div>
      );
    }

    // Distribution bars
    const { data, total } = visualization;

    return (
      <div className={cn('flex flex-col gap-0.5', className)}>
        {data.slice(0, 3).map(([valueKey, count]) => (
          <MiniBar
            key={`dist-${String(valueKey)}`}
            value={count}
            max={total}
            color="default"
          />
        ))}
      </div>
    );
  }
);

DataDistribution.displayName = 'DataDistribution';

interface CellValueIndicatorProps {
  value: unknown;
  columnType: string;
  maxValue?: number;
  minValue?: number;
  className?: string;
}

/**
 * Visual indicator for a cell value (e.g., heat map coloring for numbers)
 */
export const CellValueIndicator = memo(
  ({
    value,
    columnType,
    maxValue,
    minValue,
    className,
  }: CellValueIndicatorProps) => {
    if (value === null || value === undefined) {
      return null;
    }

    const typeLower = columnType.toLowerCase();

    // For numeric values, show a heat indicator
    if (
      (typeLower.includes('int') ||
        typeLower.includes('num') ||
        typeLower.includes('float') ||
        typeLower.includes('real')) &&
      maxValue !== undefined &&
      minValue !== undefined
    ) {
      const numValue = Number(value);
      if (!Number.isNaN(numValue)) {
        const range = maxValue - minValue || 1;
        const normalized = (numValue - minValue) / range;

        // Color gradient from blue (low) to green (mid) to red (high)
        const hue = (1 - normalized) * 240; // 240 = blue, 0 = red

        return (
          <div
            className={cn(
              'pointer-events-none absolute inset-0 opacity-10',
              className
            )}
            style={{
              backgroundColor: `hsl(${hue}, 70%, 50%)`,
            }}
          />
        );
      }
    }

    return null;
  }
);

CellValueIndicator.displayName = 'CellValueIndicator';
