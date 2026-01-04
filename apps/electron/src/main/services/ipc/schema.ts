import type {
  CompareConnectionsRequest,
  CompareConnectionToSnapshotRequest,
  CompareSnapshotsRequest,
  CompareTablesRequest,
  DeleteSchemaSnapshotRequest,
  GenerateMigrationSQLRequest,
  GenerateSyncSQLRequest,
  GetSchemaSnapshotRequest,
  SaveSchemaSnapshotRequest,
  SchemaSnapshot,
} from '@shared/types';
import { IPC_CHANNELS } from '@shared/types';
import { ipcMain } from 'electron';
import { dataDiffService } from '../data-diff';
import { dataDiffSyncGeneratorService } from '../data-diff-sync-generator';
import { databaseService } from '../database';
import { migrationGeneratorService } from '../migration-generator';
import { schemaComparisonService } from '../schema-comparison';
import {
  deleteSchemaSnapshot,
  getSchemaSnapshot,
  getSchemaSnapshots,
  saveSchemaSnapshot,
} from '../store';
import { createHandler } from './utils';

export function setupSchemaHandlers(): void {
  // Schema: Get Snapshots
  ipcMain.handle(
    IPC_CHANNELS.SCHEMA_GET_SNAPSHOTS,
    createHandler(async () => {
      const snapshots = getSchemaSnapshots();
      return { success: true, snapshots };
    })
  );

  // Schema: Get Snapshot
  ipcMain.handle(
    IPC_CHANNELS.SCHEMA_GET_SNAPSHOT,
    createHandler(async (request: GetSchemaSnapshotRequest) => {
      const snapshot = getSchemaSnapshot(request.snapshotId);
      return { success: true, snapshot };
    })
  );

  // Schema: Save Snapshot
  ipcMain.handle(
    IPC_CHANNELS.SCHEMA_SAVE_SNAPSHOT,
    createHandler(async (request: SaveSchemaSnapshotRequest) => {
      const snapshotData: SchemaSnapshot = {
        id: crypto.randomUUID(),
        name: request.name || 'Unnamed Snapshot',
        schemas: request.schema || [],
        connectionPath: request.connectionPath || '',
        description: request.description,
        createdAt: new Date().toISOString(),
      };
      saveSchemaSnapshot(snapshotData);
      return { success: true, snapshot: snapshotData };
    })
  );

  // Schema: Delete Snapshot
  ipcMain.handle(
    IPC_CHANNELS.SCHEMA_DELETE_SNAPSHOT,
    createHandler(async (request: DeleteSchemaSnapshotRequest) => {
      deleteSchemaSnapshot(request.snapshotId);
      return { success: true };
    })
  );

  // Schema: Compare Snapshots
  ipcMain.handle(
    IPC_CHANNELS.SCHEMA_COMPARE_SNAPSHOTS,
    createHandler(async (request: CompareSnapshotsRequest) => {
      const snapshotId1 = request.snapshotId1 || request.sourceSnapshotId || '';
      const snapshotId2 = request.snapshotId2 || request.targetSnapshotId || '';
      const snapshot1 = getSchemaSnapshot(snapshotId1);
      const snapshot2 = getSchemaSnapshot(snapshotId2);

      if (!snapshot1 || !snapshot2) {
        throw new Error('One or both snapshots not found');
      }

      const comparison = schemaComparisonService.compareSchemas(
        snapshot1.schemas || snapshot1.schema || [],
        snapshot2.schemas || snapshot2.schema || [],
        snapshot1.id,
        snapshot1.name,
        'snapshot',
        snapshot2.id,
        snapshot2.name,
        'snapshot'
      );
      return { success: true, comparison };
    })
  );

  // Schema: Compare Connections
  ipcMain.handle(
    IPC_CHANNELS.SCHEMA_COMPARE_CONNECTIONS,
    createHandler(async (request: CompareConnectionsRequest) => {
      const connectionId1 =
        request.connectionId1 || request.sourceConnectionId || '';
      const connectionId2 =
        request.connectionId2 || request.targetConnectionId || '';
      const schema1 = await databaseService.getSchema(connectionId1);
      const schema2 = await databaseService.getSchema(connectionId2);

      if (!schema1.success || !schema2.success) {
        throw new Error('Failed to fetch schemas');
      }

      const comparison = schemaComparisonService.compareSchemas(
        schema1.schemas || [],
        schema2.schemas || [],
        connectionId1,
        connectionId1,
        'connection',
        connectionId2,
        connectionId2,
        'connection'
      );
      return { success: true, comparison };
    })
  );

  // Schema: Compare Connection to Snapshot
  ipcMain.handle(
    IPC_CHANNELS.SCHEMA_COMPARE_CONNECTION_TO_SNAPSHOT,
    createHandler(async (request: CompareConnectionToSnapshotRequest) => {
      const connectionId = request.connectionId || '';
      const snapshotId = request.snapshotId || '';
      const liveSchema = await databaseService.getSchema(connectionId);
      const snapshot = getSchemaSnapshot(snapshotId);

      if (!liveSchema.success || !snapshot) {
        throw new Error('Failed to fetch schema or snapshot');
      }

      const comparison = schemaComparisonService.compareSchemas(
        liveSchema.schemas || [],
        snapshot.schemas || snapshot.schema || [],
        connectionId,
        connectionId,
        'connection',
        snapshot.id,
        snapshot.name,
        'snapshot'
      );
      return { success: true, comparison };
    })
  );

  // Table: Compare Tables
  ipcMain.handle(
    IPC_CHANNELS.TABLE_COMPARE,
    createHandler(async (request: CompareTablesRequest) => {
      const connectionId1 =
        request.connectionId1 || request.sourceConnectionId || '';
      const connectionId2 =
        request.connectionId2 || request.targetConnectionId || '';
      const table1 = request.table1 || request.sourceTable || '';
      const table2 = request.table2 || request.targetTable || '';
      const schema1 = request.schema1 || request.sourceSchema || '';
      const schema2 = request.schema2 || request.targetSchema || '';

      const comparison = await dataDiffService.compareTableData(
        connectionId1,
        table1,
        schema1,
        connectionId2,
        table2,
        schema2,
        request.primaryKeys || []
      );
      return { success: true, comparison };
    })
  );

  // Migration: Generate SQL
  ipcMain.handle(
    IPC_CHANNELS.MIGRATION_GENERATE_SQL,
    createHandler(async (request: GenerateMigrationSQLRequest) => {
      const result = migrationGeneratorService.generateMigrationSQL(request);
      return result;
    })
  );

  // Migration: Generate Sync SQL
  ipcMain.handle(
    IPC_CHANNELS.MIGRATION_GENERATE_SYNC_SQL,
    createHandler(async (request: GenerateSyncSQLRequest) => {
      const result = dataDiffSyncGeneratorService.generateSyncSQL(request);
      return result;
    })
  );
}
