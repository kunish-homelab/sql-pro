import { Badge } from '@sqlpro/ui/badge';
import { Button } from '@sqlpro/ui/button';
import { ScrollArea } from '@sqlpro/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@sqlpro/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@sqlpro/ui/tooltip';
import {
  AlertTriangle,
  Check,
  ExternalLink,
  Key,
  Link2,
  Loader2,
  RefreshCw,
  Shield,
  X,
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

interface ColumnConstraint {
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isNotNull: boolean;
  isUnique: boolean;
  defaultValue?: string;
  checkExpression?: string;
}

interface ForeignKeyInfo {
  id: number;
  table: string;
  from: string;
  to: string;
  onUpdate: string;
  onDelete: string;
}

interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  column: string;
  issue: string;
  affectedRows: number;
  suggestion?: string;
}

interface DataValidationPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableName?: string;
  onValidate?: () => Promise<{
    constraints: ColumnConstraint[];
    foreignKeys: ForeignKeyInfo[];
    issues: ValidationIssue[];
  }>;
  onNavigateToTable?: (tableName: string) => void;
}

const SEVERITY_STYLES = {
  error: {
    bg: 'bg-red-50 dark:bg-red-950',
    border: 'border-red-200 dark:border-red-900',
    text: 'text-red-600',
    badge: 'bg-red-100 text-red-800',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-950',
    border: 'border-amber-200 dark:border-amber-900',
    text: 'text-amber-600',
    badge: 'bg-amber-100 text-amber-800',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-950',
    border: 'border-blue-200 dark:border-blue-900',
    text: 'text-blue-600',
    badge: 'bg-blue-100 text-blue-800',
  },
};

interface ConstraintCardProps {
  constraint: ColumnConstraint;
}

const ConstraintCard = memo(({ constraint }: ConstraintCardProps) => {
  return (
    <div className="hover:bg-muted/50 flex items-center justify-between rounded-lg border p-3 transition-colors">
      <div className="flex items-center gap-3">
        <div className="bg-muted rounded-lg p-2">
          {constraint.isPrimaryKey ? (
            <Key className="h-4 w-4 text-amber-500" />
          ) : constraint.isForeignKey ? (
            <Link2 className="h-4 w-4 text-blue-500" />
          ) : (
            <Shield className="text-muted-foreground h-4 w-4" />
          )}
        </div>
        <div>
          <p className="font-medium">{constraint.name}</p>
          <p className="text-muted-foreground text-sm">{constraint.type}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {constraint.isPrimaryKey && (
          <Badge variant="secondary" className="bg-amber-100 text-amber-800">
            Primary Key
          </Badge>
        )}
        {constraint.isForeignKey && (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            Foreign Key
          </Badge>
        )}
        {constraint.isNotNull && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="outline" className="text-xs">
                  NOT NULL
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                This column cannot contain NULL values
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {constraint.isUnique && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="outline" className="text-xs">
                  UNIQUE
                </Badge>
              </TooltipTrigger>
              <TooltipContent>All values must be unique</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {constraint.defaultValue && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="secondary" className="text-xs">
                  DEFAULT
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                Default: {constraint.defaultValue}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
});

interface ForeignKeyCardProps {
  fk: ForeignKeyInfo;
  onNavigate?: (table: string) => void;
}

const ForeignKeyCard = memo(({ fk, onNavigate }: ForeignKeyCardProps) => {
  return (
    <div className="hover:bg-muted/50 rounded-lg border p-3 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900">
            <Link2 className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <p className="font-medium">
              {fk.from} → {fk.table}.{fk.to}
            </p>
            <div className="text-muted-foreground flex gap-3 text-xs">
              <span>ON UPDATE: {fk.onUpdate}</span>
              <span>ON DELETE: {fk.onDelete}</span>
            </div>
          </div>
        </div>
        {onNavigate && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate(fk.table)}
          >
            <ExternalLink className="mr-1 h-4 w-4" />
            Go to table
          </Button>
        )}
      </div>
    </div>
  );
});

interface IssueCardProps {
  issue: ValidationIssue;
}

const IssueCard = memo(({ issue }: IssueCardProps) => {
  const styles = SEVERITY_STYLES[issue.severity];

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3',
        styles.bg,
        styles.border
      )}
    >
      {issue.severity === 'error' ? (
        <X className={cn('h-5 w-5 shrink-0', styles.text)} />
      ) : issue.severity === 'warning' ? (
        <AlertTriangle className={cn('h-5 w-5 shrink-0', styles.text)} />
      ) : (
        <Check className={cn('h-5 w-5 shrink-0', styles.text)} />
      )}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Badge className={styles.badge}>{issue.column}</Badge>
          <span className="text-muted-foreground text-xs">
            {issue.affectedRows.toLocaleString()} rows affected
          </span>
        </div>
        <p className="mt-1 text-sm">{issue.issue}</p>
        {issue.suggestion && (
          <p className="text-muted-foreground mt-1 text-xs">
            💡 {issue.suggestion}
          </p>
        )}
      </div>
    </div>
  );
});

export const DataValidationPanel = memo(
  ({
    open,
    onOpenChange,
    tableName,
    onValidate,
    onNavigateToTable,
  }: DataValidationPanelProps) => {
    const [isValidating, setIsValidating] = useState(false);
    const [constraints, setConstraints] = useState<ColumnConstraint[]>([]);
    const [foreignKeys, setForeignKeys] = useState<ForeignKeyInfo[]>([]);
    const [issues, setIssues] = useState<ValidationIssue[]>([]);
    const [hasValidated, setHasValidated] = useState(false);

    const handleValidate = useCallback(async () => {
      if (!onValidate) return;

      setIsValidating(true);
      try {
        const result = await onValidate();
        setConstraints(result.constraints);
        setForeignKeys(result.foreignKeys);
        setIssues(result.issues);
        setHasValidated(true);
      } finally {
        setIsValidating(false);
      }
    }, [onValidate]);

    const errorCount = issues.filter((i) => i.severity === 'error').length;
    const warningCount = issues.filter((i) => i.severity === 'warning').length;

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[80vh] max-w-3xl flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Data Validation
              {tableName && (
                <Badge variant="secondary" className="ml-2">
                  {tableName}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              View constraints, foreign keys, and validate data integrity.
            </DialogDescription>
          </DialogHeader>

          {/* Action Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {hasValidated && (
                <>
                  {errorCount > 0 && (
                    <Badge variant="destructive">{errorCount} errors</Badge>
                  )}
                  {warningCount > 0 && (
                    <Badge className="bg-amber-100 text-amber-800">
                      {warningCount} warnings
                    </Badge>
                  )}
                  {errorCount === 0 && warningCount === 0 && (
                    <Badge className="bg-green-100 text-green-800">
                      <Check className="mr-1 h-3 w-3" />
                      All valid
                    </Badge>
                  )}
                </>
              )}
            </div>
            <Button size="sm" onClick={handleValidate} disabled={isValidating}>
              {isValidating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {hasValidated ? 'Re-validate' : 'Validate'}
            </Button>
          </div>

          {/* Content */}
          {!hasValidated ? (
            <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center py-12">
              <Shield className="mb-4 h-16 w-16 opacity-30" />
              <h3 className="mb-2 text-lg font-medium">Ready to Validate</h3>
              <p className="mb-4 text-center text-sm">
                Check column constraints, foreign key relationships,
                <br />
                and data integrity issues
              </p>
              <Button onClick={handleValidate} disabled={isValidating}>
                {isValidating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Shield className="mr-2 h-4 w-4" />
                )}
                Start Validation
              </Button>
            </div>
          ) : (
            <Tabs defaultValue="constraints" className="flex-1">
              <TabsList>
                <TabsTrigger value="constraints" className="gap-1">
                  <Shield className="h-4 w-4" />
                  Constraints ({constraints.length})
                </TabsTrigger>
                <TabsTrigger value="foreignKeys" className="gap-1">
                  <Link2 className="h-4 w-4" />
                  Foreign Keys ({foreignKeys.length})
                </TabsTrigger>
                <TabsTrigger value="issues" className="gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  Issues ({issues.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="constraints" className="mt-4">
                <ScrollArea className="h-64">
                  {constraints.length === 0 ? (
                    <div className="text-muted-foreground flex items-center justify-center py-12">
                      No constraints defined
                    </div>
                  ) : (
                    <div className="space-y-2 pr-4">
                      {constraints.map((constraint) => (
                        <ConstraintCard
                          key={constraint.name}
                          constraint={constraint}
                        />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="foreignKeys" className="mt-4">
                <ScrollArea className="h-64">
                  {foreignKeys.length === 0 ? (
                    <div className="text-muted-foreground flex items-center justify-center py-12">
                      No foreign keys defined
                    </div>
                  ) : (
                    <div className="space-y-2 pr-4">
                      {foreignKeys.map((fk) => (
                        <ForeignKeyCard
                          key={fk.id}
                          fk={fk}
                          onNavigate={onNavigateToTable}
                        />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="issues" className="mt-4">
                <ScrollArea className="h-64">
                  {issues.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Check className="mb-2 h-12 w-12 text-green-500" />
                      <p className="font-medium text-green-600">
                        No issues found
                      </p>
                      <p className="text-muted-foreground text-sm">
                        Your data passes all validation checks
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 pr-4">
                      {issues.map((issue) => (
                        <IssueCard
                          key={`${issue.column}-${issue.issue.slice(0, 30)}`}
                          issue={issue}
                        />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    );
  }
);
