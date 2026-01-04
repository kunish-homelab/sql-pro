import { Badge } from '@sqlpro/ui/badge';
import { Button } from '@sqlpro/ui/button';
import { Progress } from '@sqlpro/ui/progress';
import { ScrollArea } from '@sqlpro/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@sqlpro/ui/tabs';
import {
  BarChart3,
  Calendar,
  FileText,
  Hash,
  Loader2,
  Percent,
  PieChart,
  RefreshCw,
  ToggleLeft,
  Type,
} from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ColumnProfile {
  name: string;
  type: string;
  totalCount: number;
  nullCount: number;
  distinctCount: number;
  emptyCount: number;
  minValue?: string | number;
  maxValue?: string | number;
  avgValue?: number;
  topValues?: { value: string; count: number; percentage: number }[];
  patterns?: { pattern: string; count: number }[];
}

interface TableProfile {
  tableName: string;
  rowCount: number;
  columnCount: number;
  sizeBytes?: number;
  columns: ColumnProfile[];
  analyzedAt: Date;
}

interface DataProfilerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableName?: string;
  onAnalyze?: () => Promise<TableProfile>;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  INTEGER: Hash,
  REAL: Hash,
  FLOAT: Hash,
  DECIMAL: Hash,
  NUMERIC: Hash,
  TEXT: Type,
  VARCHAR: Type,
  CHAR: Type,
  BOOLEAN: ToggleLeft,
  BOOL: ToggleLeft,
  DATE: Calendar,
  DATETIME: Calendar,
  TIMESTAMP: Calendar,
  BLOB: FileText,
};

const getTypeIcon = (type: string): React.ElementType => {
  const upper = type.toUpperCase();
  for (const [key, icon] of Object.entries(TYPE_ICONS)) {
    if (upper.includes(key)) return icon;
  }
  return Type;
};

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ElementType;
  color?: string;
}

const StatCard = memo(
  ({
    label,
    value,
    subValue,
    icon: Icon,
    color = 'text-primary',
  }: StatCardProps) => {
    return (
      <div className="bg-muted/50 rounded-lg p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-muted-foreground text-sm">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subValue && (
              <p className="text-muted-foreground text-xs">{subValue}</p>
            )}
          </div>
          <div
            className={cn(
              'rounded-lg p-2',
              `${color.replace('text-', 'bg-')}/10`
            )}
          >
            <Icon className={cn('h-5 w-5', color)} />
          </div>
        </div>
      </div>
    );
  }
);

interface ColumnCardProps {
  column: ColumnProfile;
  onClick: () => void;
  isSelected: boolean;
}

const ColumnCard = memo(({ column, onClick, isSelected }: ColumnCardProps) => {
  const Icon = getTypeIcon(column.type);
  const nullPercentage = (column.nullCount / column.totalCount) * 100;
  const uniquePercentage = (column.distinctCount / column.totalCount) * 100;

  return (
    <button
      onClick={onClick}
      className={cn(
        'hover:border-primary/50 w-full rounded-lg border p-3 text-left transition-colors',
        isSelected && 'border-primary bg-primary/5'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="bg-muted rounded p-1.5">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="font-medium">{column.name}</p>
            <p className="text-muted-foreground text-xs">{column.type}</p>
          </div>
        </div>
        <Badge variant="secondary" className="text-xs">
          {column.distinctCount.toLocaleString()} unique
        </Badge>
      </div>
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Null %</span>
          <span>{nullPercentage.toFixed(1)}%</span>
        </div>
        <Progress value={nullPercentage} className="h-1" />
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Unique %</span>
          <span>{uniquePercentage.toFixed(1)}%</span>
        </div>
        <Progress value={uniquePercentage} className="h-1" />
      </div>
    </button>
  );
});

interface ColumnDetailProps {
  column: ColumnProfile;
}

const ColumnDetail = memo(({ column }: ColumnDetailProps) => {
  const nullPercentage = (column.nullCount / column.totalCount) * 100;
  const emptyPercentage = (column.emptyCount / column.totalCount) * 100;
  const filledPercentage = 100 - nullPercentage - emptyPercentage;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 rounded-lg p-2">
          {(() => {
            const Icon = getTypeIcon(column.type);
            return <Icon className="text-primary h-6 w-6" />;
          })()}
        </div>
        <div>
          <h3 className="text-lg font-semibold">{column.name}</h3>
          <p className="text-muted-foreground text-sm">{column.type}</p>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <p className="text-lg font-bold">
            {column.distinctCount.toLocaleString()}
          </p>
          <p className="text-muted-foreground text-xs">Distinct Values</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <p className="text-lg font-bold">{nullPercentage.toFixed(1)}%</p>
          <p className="text-muted-foreground text-xs">Null Values</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <p className="text-lg font-bold">{emptyPercentage.toFixed(1)}%</p>
          <p className="text-muted-foreground text-xs">Empty Values</p>
        </div>
      </div>

      {/* Data Quality Bar */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Data Quality</h4>
        <div className="flex h-4 overflow-hidden rounded-full">
          <div
            className="bg-green-500"
            style={{ width: `${filledPercentage}%` }}
          />
          <div
            className="bg-amber-500"
            style={{ width: `${emptyPercentage}%` }}
          />
          <div className="bg-red-500" style={{ width: `${nullPercentage}%` }} />
        </div>
        <div className="flex justify-between text-xs">
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span>Filled ({filledPercentage.toFixed(1)}%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-amber-500" />
            <span>Empty ({emptyPercentage.toFixed(1)}%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            <span>Null ({nullPercentage.toFixed(1)}%)</span>
          </div>
        </div>
      </div>

      {/* Min/Max/Avg */}
      {(column.minValue !== undefined || column.maxValue !== undefined) && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Value Range</h4>
          <div className="bg-muted/50 grid grid-cols-3 gap-3 rounded-lg p-3">
            {column.minValue !== undefined && (
              <div>
                <p className="text-muted-foreground text-xs">Min</p>
                <p className="truncate font-mono text-sm">
                  {String(column.minValue)}
                </p>
              </div>
            )}
            {column.avgValue !== undefined && (
              <div>
                <p className="text-muted-foreground text-xs">Average</p>
                <p className="font-mono text-sm">
                  {column.avgValue.toFixed(2)}
                </p>
              </div>
            )}
            {column.maxValue !== undefined && (
              <div>
                <p className="text-muted-foreground text-xs">Max</p>
                <p className="truncate font-mono text-sm">
                  {String(column.maxValue)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top Values */}
      {column.topValues && column.topValues.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Top Values</h4>
          <div className="space-y-1">
            {column.topValues.map((item) => (
              <div
                key={`${item.value}-${item.count}`}
                className="flex items-center gap-2"
              >
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate font-mono text-sm">
                      {item.value || '(empty)'}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {item.count.toLocaleString()} (
                      {item.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <Progress value={item.percentage} className="mt-1 h-1" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export const DataProfiler = memo(
  ({ open, onOpenChange, tableName, onAnalyze }: DataProfilerProps) => {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [profile, setProfile] = useState<TableProfile | null>(null);
    const [selectedColumn, setSelectedColumn] = useState<string | null>(null);

    const handleAnalyze = useCallback(async () => {
      if (!onAnalyze) return;
      setIsAnalyzing(true);
      try {
        const result = await onAnalyze();
        setProfile(result);
        if (result.columns.length > 0) {
          setSelectedColumn(result.columns[0].name);
        }
      } finally {
        setIsAnalyzing(false);
      }
    }, [onAnalyze]);

    const selectedColumnData = profile?.columns.find(
      (c) => c.name === selectedColumn
    );

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Data Profiler
              {tableName && (
                <Badge variant="secondary" className="ml-2">
                  {tableName}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Analyze column statistics, data quality, and distribution
              patterns.
            </DialogDescription>
          </DialogHeader>

          {/* Analyze Button */}
          {!profile && (
            <div className="flex flex-col items-center justify-center py-12">
              <PieChart className="text-muted-foreground mb-4 h-16 w-16 opacity-30" />
              <h3 className="mb-2 text-lg font-medium">Ready to Profile</h3>
              <p className="text-muted-foreground mb-4 text-sm">
                Analyze your data to discover patterns and quality issues
              </p>
              <Button onClick={handleAnalyze} disabled={isAnalyzing}>
                {isAnalyzing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <BarChart3 className="mr-2 h-4 w-4" />
                )}
                Start Analysis
              </Button>
            </div>
          )}

          {/* Profile Results */}
          {profile && (
            <Tabs defaultValue="overview" className="flex-1">
              <div className="flex items-center justify-between">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="columns">Columns</TabsTrigger>
                </TabsList>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                >
                  <RefreshCw
                    className={cn(
                      'mr-2 h-4 w-4',
                      isAnalyzing && 'animate-spin'
                    )}
                  />
                  Refresh
                </Button>
              </div>

              <TabsContent value="overview" className="space-y-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-4 gap-4">
                  <StatCard
                    label="Total Rows"
                    value={profile.rowCount.toLocaleString()}
                    icon={Hash}
                    color="text-blue-500"
                  />
                  <StatCard
                    label="Columns"
                    value={profile.columnCount}
                    icon={Type}
                    color="text-green-500"
                  />
                  <StatCard
                    label="Table Size"
                    value={
                      profile.sizeBytes
                        ? `${(profile.sizeBytes / 1024).toFixed(1)} KB`
                        : 'N/A'
                    }
                    icon={FileText}
                    color="text-purple-500"
                  />
                  <StatCard
                    label="Analyzed"
                    value={new Date(profile.analyzedAt).toLocaleTimeString()}
                    subValue={new Date(profile.analyzedAt).toLocaleDateString()}
                    icon={Calendar}
                    color="text-amber-500"
                  />
                </div>

                {/* Column Summary Grid */}
                <div className="space-y-2">
                  <h3 className="font-medium">Column Summary</h3>
                  <ScrollArea className="h-64">
                    <div className="grid grid-cols-2 gap-3 pr-4">
                      {profile.columns.map((col) => (
                        <ColumnCard
                          key={col.name}
                          column={col}
                          onClick={() => setSelectedColumn(col.name)}
                          isSelected={selectedColumn === col.name}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </TabsContent>

              <TabsContent value="columns" className="flex gap-4">
                {/* Column List */}
                <ScrollArea className="w-64 shrink-0">
                  <div className="space-y-1 pr-2">
                    {profile.columns.map((col) => {
                      const Icon = getTypeIcon(col.type);
                      return (
                        <button
                          key={col.name}
                          onClick={() => setSelectedColumn(col.name)}
                          className={cn(
                            'hover:bg-muted flex w-full items-center gap-2 rounded-lg p-2 text-left transition-colors',
                            selectedColumn === col.name && 'bg-muted'
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          <span className="flex-1 truncate text-sm">
                            {col.name}
                          </span>
                          <Percent className="text-muted-foreground h-3 w-3" />
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>

                {/* Column Detail */}
                <div className="flex-1 rounded-lg border p-4">
                  {selectedColumnData ? (
                    <ColumnDetail column={selectedColumnData} />
                  ) : (
                    <div className="text-muted-foreground flex h-full items-center justify-center">
                      Select a column to view details
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    );
  }
);
