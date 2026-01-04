import type { ColumnSchema } from '@/types/database';
import { Tooltip, TooltipContent, TooltipTrigger } from '@sqlpro/ui/tooltip';
import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react';
import { memo, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface DataQualityIndicatorProps {
  columns: ColumnSchema[];
  data: Record<string, unknown>[];
  className?: string;
}

interface QualityIssue {
  column: string;
  type: 'null' | 'empty' | 'duplicate' | 'type-mismatch';
  count: number;
  percentage: number;
  severity: 'info' | 'warning' | 'error';
}

interface QualityScore {
  score: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  issues: QualityIssue[];
  totalRows: number;
  totalColumns: number;
}

/**
 * Analyzes data quality and returns a score with issues
 */
function analyzeDataQuality(
  columns: ColumnSchema[],
  data: Record<string, unknown>[]
): QualityScore {
  const issues: QualityIssue[] = [];
  const totalRows = data.length;
  const totalColumns = columns.length;

  if (totalRows === 0) {
    return {
      score: 100,
      grade: 'A',
      issues: [],
      totalRows,
      totalColumns,
    };
  }

  let totalPenalty = 0;

  for (const col of columns) {
    const values = data.map((row) => row[col.name]);

    // Check for nulls
    const nullCount = values.filter(
      (v) => v === null || v === undefined
    ).length;
    const nullPercentage = (nullCount / totalRows) * 100;

    if (nullPercentage > 0) {
      const severity =
        nullPercentage > 50
          ? 'error'
          : nullPercentage > 20
            ? 'warning'
            : 'info';
      issues.push({
        column: col.name,
        type: 'null',
        count: nullCount,
        percentage: nullPercentage,
        severity,
      });
      totalPenalty +=
        severity === 'error' ? 10 : severity === 'warning' ? 5 : 1;
    }

    // Check for empty strings in text columns
    const typeLower = col.type.toLowerCase();
    if (
      typeLower.includes('text') ||
      typeLower.includes('char') ||
      typeLower.includes('varchar')
    ) {
      const emptyCount = values.filter(
        (v) => v !== null && v !== undefined && String(v).trim() === ''
      ).length;
      const emptyPercentage = (emptyCount / totalRows) * 100;

      if (emptyPercentage > 0) {
        const severity =
          emptyPercentage > 30
            ? 'warning'
            : emptyPercentage > 10
              ? 'info'
              : 'info';
        issues.push({
          column: col.name,
          type: 'empty',
          count: emptyCount,
          percentage: emptyPercentage,
          severity,
        });
        totalPenalty += severity === 'warning' ? 3 : 1;
      }
    }

    // Check for duplicates (if it's a primary key or unique-looking column)
    if (col.isPrimaryKey) {
      const uniqueValues = new Set(
        values.filter((v) => v !== null && v !== undefined)
      );
      const duplicateCount =
        values.filter((v) => v !== null && v !== undefined).length -
        uniqueValues.size;

      if (duplicateCount > 0) {
        issues.push({
          column: col.name,
          type: 'duplicate',
          count: duplicateCount,
          percentage: (duplicateCount / totalRows) * 100,
          severity: 'error',
        });
        totalPenalty += 15;
      }
    }
  }

  // Calculate score (max penalty capped at 100)
  const score = Math.max(0, 100 - Math.min(totalPenalty, 100));

  // Determine grade
  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 70) grade = 'C';
  else if (score >= 60) grade = 'D';
  else grade = 'F';

  return {
    score,
    grade,
    issues: issues.sort((a, b) => {
      const severityOrder = { error: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    }),
    totalRows,
    totalColumns,
  };
}

/**
 * A compact data quality indicator that shows overall health
 */
export const DataQualityIndicator = memo(
  ({ columns, data, className }: DataQualityIndicatorProps) => {
    const quality = useMemo(
      () => analyzeDataQuality(columns, data),
      [columns, data]
    );

    // Determine icon and color based on grade
    const {
      icon: Icon,
      colorClass,
      bgClass,
    } = useMemo(() => {
      switch (quality.grade) {
        case 'A':
          return {
            icon: CheckCircle,
            colorClass: 'text-green-600 dark:text-green-400',
            bgClass: 'bg-green-500/10',
          };
        case 'B':
          return {
            icon: CheckCircle,
            colorClass: 'text-blue-600 dark:text-blue-400',
            bgClass: 'bg-blue-500/10',
          };
        case 'C':
          return {
            icon: Info,
            colorClass: 'text-amber-600 dark:text-amber-400',
            bgClass: 'bg-amber-500/10',
          };
        case 'D':
          return {
            icon: AlertCircle,
            colorClass: 'text-orange-600 dark:text-orange-400',
            bgClass: 'bg-orange-500/10',
          };
        case 'F':
        default:
          return {
            icon: XCircle,
            colorClass: 'text-red-600 dark:text-red-400',
            bgClass: 'bg-red-500/10',
          };
      }
    }, [quality.grade]);

    return (
      <Tooltip>
        <TooltipTrigger>
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2 py-1',
              'hover:bg-muted transition-colors',
              bgClass,
              className
            )}
          >
            <Icon className={cn('h-3.5 w-3.5', colorClass)} />
            <span className={cn('text-xs font-medium', colorClass)}>
              {quality.grade}
            </span>
            <span className="text-muted-foreground text-[10px]">
              ({quality.score}%)
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="w-64 p-0">
          <div className="border-b p-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Data Quality</span>
              <span className={cn('text-lg font-bold', colorClass)}>
                {quality.grade}
              </span>
            </div>
            <div className="text-muted-foreground mt-0.5 text-xs">
              Score: {quality.score}/100 • {quality.totalRows} rows •{' '}
              {quality.totalColumns} columns
            </div>
          </div>

          {quality.issues.length > 0 ? (
            <div className="max-h-48 overflow-y-auto">
              <div className="divide-y">
                {quality.issues.slice(0, 5).map((issue) => (
                  <div
                    key={`${issue.column}-${issue.type}`}
                    className="px-2 py-1.5 text-xs"
                  >
                    <div className="flex items-center gap-1">
                      {issue.severity === 'error' && (
                        <XCircle className="h-3 w-3 text-red-500" />
                      )}
                      {issue.severity === 'warning' && (
                        <AlertCircle className="h-3 w-3 text-amber-500" />
                      )}
                      {issue.severity === 'info' && (
                        <Info className="h-3 w-3 text-blue-500" />
                      )}
                      <span className="font-medium">{issue.column}</span>
                    </div>
                    <div className="text-muted-foreground ml-4">
                      {issue.type === 'null' && (
                        <>
                          {issue.count} null values (
                          {issue.percentage.toFixed(1)}%)
                        </>
                      )}
                      {issue.type === 'empty' && (
                        <>
                          {issue.count} empty strings (
                          {issue.percentage.toFixed(1)}
                          %)
                        </>
                      )}
                      {issue.type === 'duplicate' && (
                        <>{issue.count} duplicate values</>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {quality.issues.length > 5 && (
                <div className="text-muted-foreground border-t px-2 py-1 text-[10px]">
                  +{quality.issues.length - 5} more issues
                </div>
              )}
            </div>
          ) : (
            <div className="text-muted-foreground p-3 text-center text-xs">
              <CheckCircle className="mx-auto mb-1 h-5 w-5 text-green-500" />
              No quality issues detected
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }
);

DataQualityIndicator.displayName = 'DataQualityIndicator';
