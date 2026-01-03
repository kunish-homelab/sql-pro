import type {
  ColumnInfo,
  ExportBundleRequest,
  ExportComparisonReportRequest,
  ExportQueryRequest,
  ExportRequest,
  ExportSchemaRequest,
  SchemaComparisonResult,
} from '@shared/types';
import type { Buffer } from 'node:buffer';
import { IPC_CHANNELS } from '@shared/types';
import { ipcMain } from 'electron';
import {
  generateHTMLReport,
  generateJSONReport,
  generateMarkdownReport,
} from '@/lib/comparison-report-generators';
import {
  generateCSV,
  generateExcel,
  generateJSON,
  generateSQL,
} from '@/lib/export-generators';
import { databaseService } from '../database';
import {
  exportBundle,
  exportQuery,
  exportSchema,
} from '../query-schema-sharing';
import { getSavedQueries, getSchemaSnapshot } from '../store';
import { createHandler } from './utils';

export function setupExportHandlers(): void {
  // Export: Data
  ipcMain.handle(
    IPC_CHANNELS.EXPORT_DATA,
    async (_event, request: ExportRequest) => {
      try {
        let columns: ColumnInfo[] = [];
        let rows: Record<string, unknown>[] = [];

        const tableData = await databaseService.getTableData(
          request.connectionId,
          request.table,
          1,
          999999,
          undefined,
          undefined,
          undefined,
          request.schema
        );

        if (tableData.success) {
          columns = tableData.columns || [];
          rows = (tableData.rows || []) as Record<string, unknown>[];
        }

        let output: Buffer | string = '';
        if (request.format === 'csv') {
          output = generateCSV(rows, columns);
        } else if (request.format === 'json') {
          output = generateJSON(rows, columns);
        } else if (request.format === 'sql') {
          output = generateSQL(rows, columns, { tableName: request.table });
        } else if (request.format === 'xlsx') {
          output = generateExcel(rows, columns, { sheetName: request.table });
        }

        return {
          success: true,
          data: output,
          format: request.format,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Export failed',
        };
      }
    }
  );

  // Export: Bundle
  ipcMain.handle(
    IPC_CHANNELS.EXPORT_BUNDLE,
    createHandler(async (_request: ExportBundleRequest) => {
      const { data } = await exportBundle({
        name: 'bundle',
        queries: [],
        schemas: [],
      });
      return { success: true, data };
    })
  );

  // Export: Query
  ipcMain.handle(
    IPC_CHANNELS.EXPORT_QUERY,
    createHandler(async (request: ExportQueryRequest) => {
      const savedQueries = getSavedQueries();
      const queryData = savedQueries.find((q) => q.id === request.queryId);
      if (!queryData) {
        throw new Error(`Query with ID ${request.queryId} not found`);
      }
      const { data } = await exportQuery({
        name: queryData.name,
        sql: queryData.queryText || queryData.query || '',
        databaseContext: queryData.connectionPath,
        tags: queryData.tags,
        description: queryData.description,
      });
      return { success: true, data };
    })
  );

  // Export: Schema
  ipcMain.handle(
    IPC_CHANNELS.EXPORT_SCHEMA,
    createHandler(async (request: ExportSchemaRequest) => {
      if (request.snapshotId) {
        const snapshot = getSchemaSnapshot(request.snapshotId);
        if (!snapshot) {
          throw new Error(
            `Schema snapshot with ID ${request.snapshotId} not found`
          );
        }
        const { data } = await exportSchema({
          name: snapshot.name,
          description: snapshot.description,
          databaseName: snapshot.connectionPath || '',
          databaseType: 'sqlite',
          format: 'json',
          schemas: snapshot.schemas || [],
        });
        return { success: true, data };
      }
      throw new Error('snapshotId is required');
    })
  );

  // Export: Comparison Report
  ipcMain.handle(
    IPC_CHANNELS.EXPORT_COMPARISON_REPORT,
    createHandler(async (request: ExportComparisonReportRequest) => {
      const comparisonData = (request.comparison ||
        request.comparisonResult) as SchemaComparisonResult;
      if (!comparisonData) {
        throw new Error('Comparison data is required');
      }
      let output = '';

      if (request.format === 'markdown') {
        output = generateMarkdownReport(comparisonData);
      } else if (request.format === 'html') {
        output = generateHTMLReport(comparisonData);
      } else if (request.format === 'json') {
        output = generateJSONReport(comparisonData);
      }

      return { success: true, data: output, format: request.format };
    })
  );
}
