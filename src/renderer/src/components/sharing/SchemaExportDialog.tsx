import type { ExportSchemaRequest, SchemaInfo } from '@shared/types';
import { Database, FileDown, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Textarea } from '@/components/ui/textarea';
import { sqlPro } from '@/lib/api';

export interface SchemaExportDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Connection ID to export schema from */
  connectionId: string;
  /** Database name/filename */
  databaseName?: string;
  /** Initial schema name */
  initialName?: string;
  /** Initial description */
  initialDescription?: string;
  /** Initial documentation */
  initialDocumentation?: string;
  /** Callback when export completes successfully */
  onExportComplete?: (filePath: string) => void;
}

export function SchemaExportDialog({
  open,
  onOpenChange,
  connectionId,
  databaseName = '',
  initialName = '',
  initialDescription = '',
  initialDocumentation = '',
  onExportComplete,
}: SchemaExportDialogProps) {
  // Form state
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [documentation, setDocumentation] = useState(initialDocumentation);
  const [format, setFormat] = useState<'json' | 'sql'>('json');
  const [compress, setCompress] = useState(false);

  // Export options
  const [includeIndexes, setIncludeIndexes] = useState(true);
  const [includeTriggers, setIncludeTriggers] = useState(true);
  const [includeForeignKeys, setIncludeForeignKeys] = useState(true);

  // Schema data state
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);
  const [schemas, setSchemas] = useState<SchemaInfo[]>([]);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{
    success: boolean;
    filePath?: string;
    error?: string;
  } | null>(null);

  // Load schema when dialog opens
  useEffect(() => {
    if (open && connectionId) {
      loadSchema();
    }
  }, [open, connectionId]);

  // Load schema from database
  const loadSchema = useCallback(async () => {
    setIsLoadingSchema(true);
    try {
      const result = await sqlPro.db.getSchema({ connectionId });
      if (result.success && result.schemas) {
        setSchemas(result.schemas);
        // Initially select all tables
        const allTables = new Set<string>();
        result.schemas.forEach((schema) => {
          schema.tables.forEach((table) => {
            allTables.add(`${schema.name}.${table.name}`);
          });
        });
        setSelectedTables(allTables);
      }
    } catch (error) {
      console.error('Failed to load schema:', error);
    } finally {
      setIsLoadingSchema(false);
    }
  }, [connectionId]);

  // Toggle table selection
  const toggleTable = useCallback((tableKey: string) => {
    setSelectedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableKey)) {
        next.delete(tableKey);
      } else {
        next.add(tableKey);
      }
      return next;
    });
  }, []);

  // Toggle all tables in a schema
  const toggleSchema = useCallback(
    (schemaName: string) => {
      const schema = schemas.find((s) => s.name === schemaName);
      if (!schema) return;

      const schemaTables = schema.tables.map(
        (t) => `${schemaName}.${t.name}`
      );
      const allSelected = schemaTables.every((t) => selectedTables.has(t));

      setSelectedTables((prev) => {
        const next = new Set(prev);
        if (allSelected) {
          // Deselect all tables in this schema
          schemaTables.forEach((t) => next.delete(t));
        } else {
          // Select all tables in this schema
          schemaTables.forEach((t) => next.add(t));
        }
        return next;
      });
    },
    [schemas, selectedTables]
  );

  // Validation
  const isValid =
    name.trim().length > 0 && selectedTables.size > 0 && !isLoadingSchema;

  // Handle export
  const handleExport = useCallback(async () => {
    if (!isValid) return;

    setIsExporting(true);
    setExportResult(null);

    try {
      // Filter schemas to only include selected tables
      const filteredSchemas = schemas
        .map((schema) => ({
          ...schema,
          tables: schema.tables.filter((table) =>
            selectedTables.has(`${schema.name}.${table.name}`)
          ),
          views: [], // Don't include views for now
        }))
        .filter((schema) => schema.tables.length > 0);

      const request: ExportSchemaRequest = {
        connectionId,
        schema: {
          name: name.trim(),
          description: description.trim() || undefined,
          databaseName: databaseName || undefined,
          databaseType: 'sqlite',
          format,
          schemas: filteredSchemas,
          options: {
            format,
            includeIndexes,
            includeTriggers,
            includeForeignKeys,
          },
          documentation: documentation.trim() || undefined,
        },
        compress,
      };

      const result = await sqlPro.sharing.exportSchema(request);

      setExportResult(result);

      if (result.success && result.filePath && onExportComplete) {
        onExportComplete(result.filePath);
      }
    } catch (err) {
      setExportResult({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsExporting(false);
    }
  }, [
    name,
    description,
    databaseName,
    format,
    schemas,
    selectedTables,
    includeIndexes,
    includeTriggers,
    includeForeignKeys,
    documentation,
    compress,
    connectionId,
    isValid,
    onExportComplete,
  ]);

  // Reset dialog state on close
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        // Reset state when closing
        setName(initialName);
        setDescription(initialDescription);
        setDocumentation(initialDocumentation);
        setFormat('json');
        setCompress(false);
        setIncludeIndexes(true);
        setIncludeTriggers(true);
        setIncludeForeignKeys(true);
        setExportResult(null);
      }
      onOpenChange(newOpen);
    },
    [
      onOpenChange,
      initialName,
      initialDescription,
      initialDocumentation,
    ]
  );

  // Calculate total selected tables
  const totalTables = schemas.reduce(
    (sum, schema) => sum + schema.tables.length,
    0
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Export Schema
          </DialogTitle>
          <DialogDescription>
            Export database schema definitions with table structures, indexes,
            and relationships
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {exportResult ? (
            <div className="space-y-3">
              {exportResult.success ? (
                <div className="space-y-2 rounded-lg bg-green-50 p-4 dark:bg-green-950">
                  <p className="font-medium text-green-900 dark:text-green-100">
                    Export Successful
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Schema exported successfully
                  </p>
                  {exportResult.filePath && (
                    <p className="break-all text-xs text-green-600 dark:text-green-400">
                      {exportResult.filePath}
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-destructive/10 rounded-lg p-4">
                  <p className="text-destructive font-medium">Export Failed</p>
                  <p className="text-destructive/80 mt-1 text-sm">
                    {exportResult.error || 'Unknown error occurred'}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Schema Name (Required) */}
              <div className="space-y-2">
                <Label htmlFor="schema-name" className="text-sm font-medium">
                  Schema Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="schema-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Production Database Schema"
                  maxLength={200}
                  disabled={isExporting || isLoadingSchema}
                />
                <p className="text-muted-foreground text-xs">
                  A descriptive name for this schema export
                </p>
              </div>

              {/* Description (Optional) */}
              <div className="space-y-2">
                <Label
                  htmlFor="schema-description"
                  className="text-sm font-medium"
                >
                  Description
                </Label>
                <Textarea
                  id="schema-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this database schema"
                  maxLength={1000}
                  rows={2}
                  disabled={isExporting || isLoadingSchema}
                />
                <p className="text-muted-foreground text-xs">
                  Optional description to help others understand the schema
                  purpose
                </p>
              </div>

              {/* Export Format */}
              <div className="space-y-2">
                <Label htmlFor="format" className="text-sm font-medium">
                  Export Format <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={format}
                  onValueChange={(value: 'json' | 'sql') => setFormat(value)}
                  disabled={isExporting || isLoadingSchema}
                >
                  <SelectTrigger id="format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="json">JSON (Schema Metadata)</SelectItem>
                    <SelectItem value="sql">SQL (CREATE Statements)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  {format === 'json'
                    ? 'Export as structured JSON with table metadata'
                    : 'Export as SQL CREATE TABLE statements'}
                </p>
              </div>

              {/* Table Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Tables to Export <span className="text-destructive">*</span>
                </Label>
                {isLoadingSchema ? (
                  <div className="flex items-center justify-center rounded-md border p-8">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Loading schema...</span>
                    </div>
                  </div>
                ) : schemas.length === 0 ? (
                  <div className="rounded-md border p-4 text-center text-muted-foreground text-sm">
                    No tables found in this database
                  </div>
                ) : (
                  <div className="space-y-2 rounded-md border p-3 max-h-64 overflow-y-auto">
                    {schemas.map((schema) => (
                      <div key={schema.name} className="space-y-2">
                        {/* Schema header with select all */}
                        <div className="flex items-center gap-2 border-b pb-2">
                          <Checkbox
                            checked={schema.tables.every((table) =>
                              selectedTables.has(`${schema.name}.${table.name}`)
                            )}
                            onCheckedChange={() => toggleSchema(schema.name)}
                            disabled={isExporting}
                          />
                          <span className="font-medium text-sm">
                            {schema.name}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            ({schema.tables.length} table
                            {schema.tables.length !== 1 ? 's' : ''})
                          </span>
                        </div>
                        {/* Tables */}
                        <div className="ml-6 space-y-1">
                          {schema.tables.map((table) => {
                            const tableKey = `${schema.name}.${table.name}`;
                            return (
                              <label
                                key={tableKey}
                                className="flex cursor-pointer items-center gap-2 hover:bg-muted/50 p-1 rounded"
                              >
                                <Checkbox
                                  checked={selectedTables.has(tableKey)}
                                  onCheckedChange={() => toggleTable(tableKey)}
                                  disabled={isExporting}
                                />
                                <span className="text-sm">{table.name}</span>
                                <span className="text-muted-foreground text-xs">
                                  ({table.columns.length} column
                                  {table.columns.length !== 1 ? 's' : ''})
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-muted-foreground text-xs">
                  Selected {selectedTables.size} of {totalTables} table
                  {totalTables !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Export Options */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Include in Export</Label>
                <div className="space-y-3 rounded-md border p-3">
                  <label className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={includeIndexes}
                      onCheckedChange={(checked) =>
                        setIncludeIndexes(checked === true)
                      }
                      disabled={isExporting || isLoadingSchema}
                    />
                    <div className="flex-1">
                      <p className="text-sm">Indexes</p>
                      <p className="text-muted-foreground text-xs">
                        Include table indexes and unique constraints
                      </p>
                    </div>
                  </label>

                  <label className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={includeTriggers}
                      onCheckedChange={(checked) =>
                        setIncludeTriggers(checked === true)
                      }
                      disabled={isExporting || isLoadingSchema}
                    />
                    <div className="flex-1">
                      <p className="text-sm">Triggers</p>
                      <p className="text-muted-foreground text-xs">
                        Include database triggers
                      </p>
                    </div>
                  </label>

                  <label className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={includeForeignKeys}
                      onCheckedChange={(checked) =>
                        setIncludeForeignKeys(checked === true)
                      }
                      disabled={isExporting || isLoadingSchema}
                    />
                    <div className="flex-1">
                      <p className="text-sm">Foreign Keys</p>
                      <p className="text-muted-foreground text-xs">
                        Include foreign key relationships
                      </p>
                    </div>
                  </label>

                  <label className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={compress}
                      onCheckedChange={(checked) =>
                        setCompress(checked === true)
                      }
                      disabled={isExporting || isLoadingSchema}
                    />
                    <div className="flex-1">
                      <p className="text-sm">Compress export file</p>
                      <p className="text-muted-foreground text-xs">
                        Automatically enabled for schemas larger than 100KB
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Documentation (Optional) */}
              <div className="space-y-2">
                <Label
                  htmlFor="schema-documentation"
                  className="text-sm font-medium"
                >
                  Documentation
                </Label>
                <Textarea
                  id="schema-documentation"
                  value={documentation}
                  onChange={(e) => setDocumentation(e.target.value)}
                  placeholder="Additional notes, migration instructions, or important considerations..."
                  maxLength={10000}
                  rows={3}
                  disabled={isExporting || isLoadingSchema}
                />
                <p className="text-muted-foreground text-xs">
                  Optional detailed documentation or usage notes (
                  {documentation.length}/10000)
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isExporting}
          >
            {exportResult ? 'Close' : 'Cancel'}
          </Button>
          {!exportResult && (
            <Button onClick={handleExport} disabled={!isValid || isExporting}>
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <FileDown className="mr-2 h-4 w-4" />
                  Export
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
