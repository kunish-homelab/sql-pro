import type {
  AISettings,
  ProFeatureType,
  ProStatus,
  QueryHistoryEntry,
  SchemaSnapshot,
} from '../../shared/types';
import process from 'node:process';
import { app } from 'electron';
import Store from 'electron-store';

// ============ Type Definitions ============

export interface StoredPreferences {
  theme: 'light' | 'dark' | 'system';
  defaultPageSize: number;
  confirmBeforeApply: boolean;
  recentConnectionsLimit: number;
}

export interface StoredRecentConnection {
  path: string;
  filename: string;
  isEncrypted: boolean;
  lastOpened: string;
  displayName?: string;
  readOnly?: boolean;
  createdAt?: string;
}

interface QueryHistoryStore {
  [dbPath: string]: QueryHistoryEntry[];
}

interface SchemaSnapshotStore {
  [snapshotId: string]: SchemaSnapshot;
}

// ============ Store Schema ============

interface StoreSchema {
  preferences: StoredPreferences;
  recentConnections: StoredRecentConnection[];
  queryHistory: QueryHistoryStore;
  aiSettings: AISettings | null;
  proStatus: ProStatus | null;
  schemaSnapshots: SchemaSnapshotStore;
}

// ============ Default Values ============

const DEFAULT_PREFERENCES: StoredPreferences = {
  theme: 'system',
  defaultPageSize: 100,
  confirmBeforeApply: true,
  recentConnectionsLimit: 10,
};

// ============ Store Instance ============

const store = new Store<StoreSchema>({
  name: 'sql-pro-data',
  defaults: {
    preferences: DEFAULT_PREFERENCES,
    recentConnections: [],
    queryHistory: {},
    aiSettings: null,
    proStatus: null,
    schemaSnapshots: {},
  },
  // Enable schema migration
  migrations: {
    // Future migrations can be added here
    // '1.0.0': (store) => { ... }
  },
});

// ============ Preferences ============

export function getPreferences(): StoredPreferences {
  return store.get('preferences', DEFAULT_PREFERENCES);
}

export function setPreferences(prefs: Partial<StoredPreferences>): void {
  const current = getPreferences();
  store.set('preferences', { ...current, ...prefs });
}

export function resetPreferences(): void {
  store.set('preferences', DEFAULT_PREFERENCES);
}

// ============ Recent Connections ============

export function getRecentConnections(): StoredRecentConnection[] {
  return store.get('recentConnections', []);
}

export function addRecentConnection(
  filePath: string,
  filename: string,
  isEncrypted: boolean,
  displayName?: string,
  readOnly?: boolean
): void {
  const connections = getRecentConnections();
  const prefs = getPreferences();

  // Check if this connection already exists
  const existing = connections.find((c) => c.path === filePath);

  // Remove existing entry for this path
  const filtered = connections.filter((c) => c.path !== filePath);

  const now = new Date().toISOString();

  // Add new entry at the beginning, preserving existing settings if not provided
  filtered.unshift({
    path: filePath,
    filename,
    isEncrypted,
    lastOpened: now,
    displayName: displayName ?? existing?.displayName ?? filename,
    readOnly: readOnly ?? existing?.readOnly ?? false,
    createdAt: existing?.createdAt ?? now,
  });

  // Limit to configured max
  const limited = filtered.slice(0, prefs.recentConnectionsLimit);

  store.set('recentConnections', limited);
}

export function updateRecentConnection(
  filePath: string,
  updates: { displayName?: string; readOnly?: boolean }
): { success: boolean; error?: string } {
  const connections = getRecentConnections();
  const index = connections.findIndex((c) => c.path === filePath);

  if (index === -1) {
    return { success: false, error: 'CONNECTION_NOT_FOUND' };
  }

  // Validate displayName if provided
  if (updates.displayName !== undefined) {
    if (updates.displayName.length === 0 || updates.displayName.length > 100) {
      return { success: false, error: 'INVALID_DISPLAY_NAME' };
    }
  }

  // Update the connection
  if (updates.displayName !== undefined) {
    connections[index].displayName = updates.displayName;
  }
  if (updates.readOnly !== undefined) {
    connections[index].readOnly = updates.readOnly;
  }

  store.set('recentConnections', connections);
  return { success: true };
}

export function removeRecentConnection(filePath: string): {
  success: boolean;
  error?: string;
} {
  const connections = getRecentConnections();
  const filtered = connections.filter((c) => c.path !== filePath);

  if (filtered.length === connections.length) {
    // Connection was not found, but this is not an error
    return { success: true };
  }

  store.set('recentConnections', filtered);
  return { success: true };
}

// ============ Query History ============

export function getQueryHistory(dbPath: string): QueryHistoryEntry[] {
  const allHistory = store.get('queryHistory', {});
  return allHistory[dbPath] || [];
}

export function saveQueryHistoryEntry(entry: QueryHistoryEntry): void {
  const allHistory = store.get('queryHistory', {});
  const dbHistory = allHistory[entry.dbPath] || [];

  // Add new entry at the beginning (most recent first)
  dbHistory.unshift(entry);

  allHistory[entry.dbPath] = dbHistory;
  store.set('queryHistory', allHistory);
}

export function deleteQueryHistoryEntry(
  dbPath: string,
  entryId: string
): { success: boolean; error?: string } {
  const allHistory = store.get('queryHistory', {});
  const dbHistory = allHistory[dbPath] || [];

  const filtered = dbHistory.filter((entry) => entry.id !== entryId);

  if (filtered.length === dbHistory.length) {
    // Entry not found, but not an error
    return { success: true };
  }

  allHistory[dbPath] = filtered;
  store.set('queryHistory', allHistory);
  return { success: true };
}

export function clearQueryHistory(dbPath: string): {
  success: boolean;
  error?: string;
} {
  const allHistory = store.get('queryHistory', {});

  // Remove history for this database
  delete allHistory[dbPath];

  store.set('queryHistory', allHistory);
  return { success: true };
}

// ============ AI Settings ============

export function getAISettings(): AISettings | null {
  return store.get('aiSettings', null);
}

export function saveAISettings(settings: AISettings): void {
  store.set('aiSettings', settings);
}

export function clearAISettings(): void {
  store.set('aiSettings', null);
}

// ============ Pro Status ============

// All Pro features
const ALL_PRO_FEATURES = [
  'ai_assistant',
  'advanced_analytics',
  'export_formats',
  'batch_operations',
  'performance_monitoring',
] as ProFeatureType[];

export function getProStatus(): ProStatus | null {
  // In development mode, always return Pro status with all features enabled
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    return {
      isPro: true,
      licenseKey: 'dev-license',
      activatedAt: new Date().toISOString(),
      features: [...ALL_PRO_FEATURES],
    };
  }
  return store.get('proStatus', null);
}

export function saveProStatus(status: ProStatus): void {
  store.set('proStatus', status);
}

export function clearProStatus(): void {
  store.set('proStatus', null);
}

// ============ Schema Snapshots ============

export function saveSchemaSnapshot(snapshot: SchemaSnapshot): void {
  const snapshots = store.get('schemaSnapshots', {});
  snapshots[snapshot.id] = snapshot;
  store.set('schemaSnapshots', snapshots);
}

export function getSchemaSnapshots(): SchemaSnapshot[] {
  const snapshots = store.get('schemaSnapshots', {});
  return Object.values(snapshots).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getSchemaSnapshot(snapshotId: string): SchemaSnapshot | null {
  const snapshots = store.get('schemaSnapshots', {});
  return snapshots[snapshotId] || null;
}

export function deleteSchemaSnapshot(snapshotId: string): {
  success: boolean;
  error?: string;
} {
  const snapshots = store.get('schemaSnapshots', {});

  if (!snapshots[snapshotId]) {
    // Snapshot not found, but not an error
    return { success: true };
  }

  delete snapshots[snapshotId];
  store.set('schemaSnapshots', snapshots);
  return { success: true };
}

// ============ Utility Functions ============

export function clearAllData(): void {
  store.clear();
}

export function getStorePath(): string {
  return store.path;
}

// Export the store instance for advanced usage
export { store };
