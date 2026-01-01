import { Database, FileText, Loader2, Plus, Save } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { sqlPro } from '@/lib/api';
import { useConnectionStore, useSchemaComparisonStore } from '@/stores';
import type { ComparisonSource } from '@/stores/schema-comparison-store';
import type { DatabaseConnection } from '@/types/database';

interface SourceSelectorProps {
  /** Which source is being selected (source or target) */
  type: 'source' | 'target';
  /** Current selection */
  value: ComparisonSource | null;
  /** Callback when selection changes */
  onChange: (source: ComparisonSource | null) => void;
  /** Label for the selector */
  label?: string;
}

/**
 * Component to select comparison source (connection or snapshot).
 * Allows toggling between connection and snapshot mode, selecting from
 * available options, and creating new snapshots.
 */
export function SourceSelector({
  type,
  value,
  onChange,
  label = type === 'source' ? 'Source' : 'Target',
}: SourceSelectorProps) {
  const { getAllConnections } = useConnectionStore();
  const { availableSnapshots, addSnapshot } = useSchemaComparisonStore();

  const [sourceType, setSourceType] = useState<'connection' | 'snapshot'>(
    value?.type || 'connection'
  );
  const [showCreateSnapshotDialog, setShowCreateSnapshotDialog] =
    useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [selectedConnectionForSnapshot, setSelectedConnectionForSnapshot] =
    useState<string>('');
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const [createSnapshotError, setCreateSnapshotError] = useState<string | null>(
    null
  );

  const availableConnections = getAllConnections();

  // Handle source type change (connection vs snapshot)
  const handleSourceTypeChange = useCallback(
    (newType: string) => {
      const type = newType as 'connection' | 'snapshot';
      setSourceType(type);
      // Clear selection when switching types
      onChange(null);
    },
    [onChange]
  );

  // Handle connection selection
  const handleConnectionSelect = useCallback(
    (connectionId: string | null) => {
      if (!connectionId) return;
      const connection = availableConnections.find((c) => c.id === connectionId);
      if (connection) {
        onChange({
          type: 'connection',
          connectionId: connection.id,
          name: connection.filename || `Connection ${connection.id}`,
        });
      }
    },
    [availableConnections, onChange]
  );

  // Handle snapshot selection
  const handleSnapshotSelect = useCallback(
    (snapshotId: string | null) => {
      if (!snapshotId) return;
      const snapshot = availableSnapshots.find((s) => s.id === snapshotId);
      if (snapshot) {
        onChange({
          type: 'snapshot',
          snapshotId: snapshot.id,
          name: snapshot.name,
        });
      }
    },
    [availableSnapshots, onChange]
  );

  // Handle create snapshot dialog open
  const handleOpenCreateSnapshot = useCallback(() => {
    setShowCreateSnapshotDialog(true);
    setSnapshotName('');
    setCreateSnapshotError(null);
    // Pre-select first available connection
    if (availableConnections.length > 0) {
      setSelectedConnectionForSnapshot(availableConnections[0].id);
    }
  }, [availableConnections]);

  // Handle create snapshot
  const handleCreateSnapshot = useCallback(async () => {
    if (!snapshotName.trim()) {
      setCreateSnapshotError('Please enter a snapshot name');
      return;
    }

    if (!selectedConnectionForSnapshot) {
      setCreateSnapshotError('Please select a connection');
      return;
    }

    setIsCreatingSnapshot(true);
    setCreateSnapshotError(null);

    try {
      const response = await sqlPro.schemaSnapshot.save({
        connectionId: selectedConnectionForSnapshot,
        name: snapshotName.trim(),
      });

      if (response.success && response.snapshot) {
        // Add snapshot to store
        addSnapshot(response.snapshot);

        // Auto-select the newly created snapshot
        onChange({
          type: 'snapshot',
          snapshotId: response.snapshot.id,
          name: response.snapshot.name,
        });

        // Switch to snapshot tab
        setSourceType('snapshot');

        // Close dialog
        setShowCreateSnapshotDialog(false);
        setSnapshotName('');
      } else {
        setCreateSnapshotError(response.error || 'Failed to create snapshot');
      }
    } catch (error) {
      setCreateSnapshotError(
        error instanceof Error ? error.message : 'An unexpected error occurred'
      );
    } finally {
      setIsCreatingSnapshot(false);
    }
  }, [
    snapshotName,
    selectedConnectionForSnapshot,
    addSnapshot,
    onChange,
  ]);

  // Get display name for selected connection/snapshot
  const getDisplayName = () => {
    if (!value) return 'Select...';
    return value.name || 'Unknown';
  };

  // Get connection status indicator color
  const getStatusColor = (connection: DatabaseConnection) => {
    switch (connection.status) {
      case 'connected':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <>
      <div className="space-y-3">
        <Label className="text-sm font-medium">{label}</Label>

        {/* Toggle between Connection and Snapshot */}
        <Tabs value={sourceType} onValueChange={handleSourceTypeChange}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="connection">
              <Database className="mr-2 h-3.5 w-3.5" />
              Connection
            </TabsTrigger>
            <TabsTrigger value="snapshot">
              <FileText className="mr-2 h-3.5 w-3.5" />
              Snapshot
            </TabsTrigger>
          </TabsList>

          <TabsContent value="connection" className="mt-3 space-y-2">
            {availableConnections.length > 0 ? (
              <Select
                value={
                  value?.type === 'connection' ? value.connectionId : undefined
                }
                onValueChange={handleConnectionSelect}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a connection">
                    {value?.type === 'connection' && (
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            availableConnections.find(
                              (c) => c.id === value.connectionId
                            )
                              ? getStatusColor(
                                  availableConnections.find(
                                    (c) => c.id === value.connectionId
                                  )!
                                )
                              : 'bg-gray-400'
                          }`}
                        />
                        <span className="truncate">{getDisplayName()}</span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableConnections.map((conn) => (
                    <SelectItem key={conn.id} value={conn.id}>
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${getStatusColor(
                            conn
                          )}`}
                        />
                        <span className="truncate">{conn.filename}</span>
                        {conn.isReadOnly && (
                          <span className="bg-muted text-muted-foreground shrink-0 rounded px-1 py-0.5 text-[10px]">
                            R/O
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="text-muted-foreground rounded-md border border-dashed p-4 text-center text-sm">
                No connections available. Open a database first.
              </div>
            )}
          </TabsContent>

          <TabsContent value="snapshot" className="mt-3 space-y-2">
            {availableSnapshots.length > 0 ? (
              <Select
                value={
                  value?.type === 'snapshot' ? value.snapshotId : undefined
                }
                onValueChange={handleSnapshotSelect}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a snapshot">
                    {value?.type === 'snapshot' && (
                      <div className="flex items-center gap-2">
                        <FileText className="text-muted-foreground h-3.5 w-3.5" />
                        <span className="truncate">{getDisplayName()}</span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableSnapshots.map((snapshot) => (
                    <SelectItem key={snapshot.id} value={snapshot.id}>
                      <div className="flex items-center gap-2">
                        <FileText className="text-muted-foreground h-3.5 w-3.5" />
                        <div className="flex flex-col">
                          <span className="truncate">{snapshot.name}</span>
                          <span className="text-muted-foreground text-xs">
                            {snapshot.tableCount} table
                            {snapshot.tableCount !== 1 ? 's' : ''} •{' '}
                            {new Date(snapshot.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="text-muted-foreground rounded-md border border-dashed p-4 text-center text-sm">
                No snapshots available. Create one below.
              </div>
            )}

            {/* Create Snapshot Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenCreateSnapshot}
              disabled={availableConnections.length === 0}
              className="w-full"
            >
              <Plus className="mr-2 h-3.5 w-3.5" />
              Create New Snapshot
            </Button>
            {availableConnections.length === 0 && (
              <p className="text-muted-foreground text-xs">
                Open a database connection first
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Snapshot Dialog */}
      <Dialog
        open={showCreateSnapshotDialog}
        onOpenChange={setShowCreateSnapshotDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Schema Snapshot</DialogTitle>
            <DialogDescription>
              Save the current schema state for later comparison
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Snapshot Name */}
            <div className="space-y-2">
              <Label htmlFor="snapshot-name">Snapshot Name</Label>
              <Input
                id="snapshot-name"
                placeholder="e.g., Production v1.2.0"
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isCreatingSnapshot) {
                    handleCreateSnapshot();
                  }
                }}
              />
            </div>

            {/* Connection Selection */}
            <div className="space-y-2">
              <Label htmlFor="snapshot-connection">Connection</Label>
              <Select
                value={selectedConnectionForSnapshot}
                onValueChange={(value) => {
                  if (value) setSelectedConnectionForSnapshot(value);
                }}
              >
                <SelectTrigger id="snapshot-connection">
                  <SelectValue placeholder="Select a connection">
                    {selectedConnectionForSnapshot && (
                      <div className="flex items-center gap-2">
                        <Database className="text-muted-foreground h-3.5 w-3.5" />
                        <span className="truncate">
                          {availableConnections.find(
                            (c) => c.id === selectedConnectionForSnapshot
                          )?.filename || 'Unknown'}
                        </span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableConnections.map((conn) => (
                    <SelectItem key={conn.id} value={conn.id}>
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${getStatusColor(
                            conn
                          )}`}
                        />
                        <span className="truncate">{conn.filename}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Error Message */}
            {createSnapshotError && (
              <div className="text-destructive text-sm">
                {createSnapshotError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateSnapshotDialog(false)}
              disabled={isCreatingSnapshot}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateSnapshot}
              disabled={isCreatingSnapshot || !snapshotName.trim()}
            >
              {isCreatingSnapshot ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Create Snapshot
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
