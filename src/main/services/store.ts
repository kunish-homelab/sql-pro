import type {
  AISettings,
  ProFeatureType,
  ProStatus,
  QueryHistoryEntry,
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

export interface StoredConnectionProfile extends StoredRecentConnection {
  id: string;
  folderId?: string;
  tags?: string[];
  notes?: string;
  isSaved: boolean;
}

export interface StoredProfileFolder {
  id: string;
  name: string;
  parentId?: string;
  createdAt: string;
  expanded?: boolean;
}

interface QueryHistoryStore {
  [dbPath: string]: QueryHistoryEntry[];
}

// ============ Store Schema ============

interface StoreSchema {
  preferences: StoredPreferences;
  recentConnections: StoredRecentConnection[];
  queryHistory: QueryHistoryStore;
  aiSettings: AISettings | null;
  proStatus: ProStatus | null;
  connectionProfiles: StoredConnectionProfile[];
  profileFolders: StoredProfileFolder[];
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
    connectionProfiles: [],
    profileFolders: [],
  },
  // Enable schema migration
  migrations: {
    // Migration to convert existing recent connections to profiles
    '>=1.0.0': (store) => {
      // Get existing data
      const recentConnections = store.get(
        'recentConnections',
        []
      ) as StoredRecentConnection[];
      const existingProfiles = store.get(
        'connectionProfiles',
        []
      ) as StoredConnectionProfile[];

      // Only migrate if we have recent connections and no profiles yet
      // This ensures migration only runs once
      if (recentConnections.length > 0 && existingProfiles.length === 0) {
        const migratedProfiles: StoredConnectionProfile[] =
          recentConnections.map((conn) => ({
            ...conn,
            id: crypto.randomUUID(),
            isSaved: false, // Mark as unsaved since these are just recent connections
            // Optional fields remain undefined
          }));

        store.set('connectionProfiles', migratedProfiles);
      }
    },
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

// ============ Connection Profiles ============

export function getProfiles(): StoredConnectionProfile[] {
  return store.get('connectionProfiles', []);
}

export function saveProfile(
  profile: Omit<StoredConnectionProfile, 'id' | 'createdAt'> & {
    id?: string;
  }
): { success: boolean; profile?: StoredConnectionProfile; error?: string } {
  try {
    const profiles = getProfiles();
    const now = new Date().toISOString();

    // Generate ID if not provided
    const profileId = profile.id || crypto.randomUUID();

    // Check if profile with this ID already exists
    const existingIndex = profiles.findIndex((p) => p.id === profileId);

    const newProfile: StoredConnectionProfile = {
      ...profile,
      id: profileId,
      createdAt: existingIndex !== -1 ? profiles[existingIndex].createdAt : now,
      displayName: profile.displayName ?? profile.filename,
      readOnly: profile.readOnly ?? false,
      tags: profile.tags ?? [],
      isSaved: profile.isSaved ?? true,
    };

    // Validate displayName if provided
    if (newProfile.displayName && newProfile.displayName.length > 100) {
      return { success: false, error: 'INVALID_DISPLAY_NAME' };
    }

    if (existingIndex !== -1) {
      // Update existing profile
      profiles[existingIndex] = newProfile;
    } else {
      // Add new profile
      profiles.push(newProfile);
    }

    store.set('connectionProfiles', profiles);
    return { success: true, profile: newProfile };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    };
  }
}

export function updateProfile(
  id: string,
  updates: Partial<Omit<StoredConnectionProfile, 'id' | 'createdAt'>>
): { success: boolean; profile?: StoredConnectionProfile; error?: string } {
  const profiles = getProfiles();
  const index = profiles.findIndex((p) => p.id === id);

  if (index === -1) {
    return { success: false, error: 'PROFILE_NOT_FOUND' };
  }

  // Validate displayName if provided
  if (updates.displayName !== undefined) {
    if (updates.displayName.length === 0 || updates.displayName.length > 100) {
      return { success: false, error: 'INVALID_DISPLAY_NAME' };
    }
  }

  // Update the profile
  const updatedProfile = {
    ...profiles[index],
    ...updates,
  };

  profiles[index] = updatedProfile;

  store.set('connectionProfiles', profiles);
  return { success: true, profile: updatedProfile };
}

export function deleteProfile(id: string): {
  success: boolean;
  error?: string;
} {
  const profiles = getProfiles();
  const filtered = profiles.filter((p) => p.id !== id);

  if (filtered.length === profiles.length) {
    // Profile was not found, but this is not an error
    return { success: true };
  }

  store.set('connectionProfiles', filtered);
  return { success: true };
}

export function getProfilesByFolder(
  folderId?: string
): StoredConnectionProfile[] {
  const profiles = getProfiles();
  if (folderId === undefined) {
    // Return root-level profiles (no folder)
    return profiles.filter((p) => !p.folderId);
  }
  return profiles.filter((p) => p.folderId === folderId);
}

// ============ Profile Folders ============

export function getFolders(): StoredProfileFolder[] {
  return store.get('profileFolders', []);
}

export function saveFolder(
  folder: Omit<StoredProfileFolder, 'id' | 'createdAt'> & {
    id?: string;
  }
): { success: boolean; folder?: StoredProfileFolder; error?: string } {
  try {
    const folders = getFolders();
    const now = new Date().toISOString();

    // Generate ID if not provided
    const folderId = folder.id || crypto.randomUUID();

    // Validate folder name
    if (!folder.name || folder.name.trim().length === 0) {
      return { success: false, error: 'INVALID_FOLDER_NAME' };
    }
    if (folder.name.length > 100) {
      return { success: false, error: 'FOLDER_NAME_TOO_LONG' };
    }

    // Check if folder with this ID already exists
    const existingIndex = folders.findIndex((f) => f.id === folderId);

    const newFolder: StoredProfileFolder = {
      ...folder,
      id: folderId,
      name: folder.name.trim(),
      createdAt: existingIndex !== -1 ? folders[existingIndex].createdAt : now,
      expanded: folder.expanded ?? true,
    };

    if (existingIndex !== -1) {
      // Update existing folder
      folders[existingIndex] = newFolder;
    } else {
      // Add new folder
      folders.push(newFolder);
    }

    store.set('profileFolders', folders);
    return { success: true, folder: newFolder };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    };
  }
}

export function updateFolder(
  id: string,
  updates: Partial<Omit<StoredProfileFolder, 'id' | 'createdAt'>>
): { success: boolean; folder?: StoredProfileFolder; error?: string } {
  const folders = getFolders();
  const index = folders.findIndex((f) => f.id === id);

  if (index === -1) {
    return { success: false, error: 'FOLDER_NOT_FOUND' };
  }

  // Validate folder name if provided
  if (updates.name !== undefined) {
    if (updates.name.trim().length === 0) {
      return { success: false, error: 'INVALID_FOLDER_NAME' };
    }
    if (updates.name.length > 100) {
      return { success: false, error: 'FOLDER_NAME_TOO_LONG' };
    }
  }

  // Update the folder
  const updatedFolder = {
    ...folders[index],
    ...updates,
  };

  // Trim name if it was updated
  if (updates.name !== undefined) {
    updatedFolder.name = updates.name.trim();
  }

  folders[index] = updatedFolder;

  store.set('profileFolders', folders);
  return { success: true, folder: updatedFolder };
}

export function deleteFolder(id: string): {
  success: boolean;
  error?: string;
} {
  const folders = getFolders();
  const profiles = getProfiles();

  // Check if folder has child folders
  const hasChildren = folders.some((f) => f.parentId === id);
  if (hasChildren) {
    return { success: false, error: 'FOLDER_HAS_CHILDREN' };
  }

  // Check if folder has profiles
  const hasProfiles = profiles.some((p) => p.folderId === id);
  if (hasProfiles) {
    return { success: false, error: 'FOLDER_HAS_PROFILES' };
  }

  const filtered = folders.filter((f) => f.id !== id);

  if (filtered.length === folders.length) {
    // Folder was not found, but this is not an error
    return { success: true };
  }

  store.set('profileFolders', filtered);
  return { success: true };
}

export function getSubfolders(parentId?: string): StoredProfileFolder[] {
  const folders = getFolders();
  if (parentId === undefined) {
    // Return root-level folders (no parent)
    return folders.filter((f) => !f.parentId);
  }
  return folders.filter((f) => f.parentId === parentId);
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
