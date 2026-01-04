/**
 * E2E Tests for Connection Profile Lifecycle
 *
 * Tests the complete profile lifecycle:
 * 1. Create profile with folder
 * 2. Verify profile persistence
 * 3. Export profiles
 * 4. Delete profile
 * 5. Import profiles
 * 6. Verify restoration (without passwords)
 */

import type { ConnectionProfile, ProfileFolder } from '@shared/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  exportProfiles,
  importProfiles,
  parseImportData,
  serializeExportData,
} from '../profile-import-export';
import {
  deleteFolder,
  deleteProfile,
  getFolders,
  getProfiles,
  saveFolder,
  saveProfile,
} from '../store';

describe('profile Lifecycle E2E', () => {
  let testProfile: ConnectionProfile;
  let testFolder: ProfileFolder;

  beforeEach(() => {
    // Create test folder
    testFolder = {
      id: crypto.randomUUID(),
      name: 'Test E2E Folder',
      parentId: undefined,
      createdAt: new Date().toISOString(),
    };
    saveFolder(testFolder);

    // Create test profile
    testProfile = {
      id: crypto.randomUUID(),
      path: '/tmp/test-e2e.sqlite',
      filename: 'test-e2e.sqlite',
      displayName: 'Test E2E Profile',
      folderId: testFolder.id,
      tags: ['e2e', 'testing'],
      notes: 'E2E test profile',
      isSaved: true,
      isEncrypted: false,
      readOnly: false,
      lastOpened: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
  });

  afterEach(() => {
    // Cleanup: Delete test profile and folder
    if (testProfile) {
      deleteProfile(testProfile.id);
    }
    if (testFolder) {
      deleteFolder(testFolder.id);
    }
  });

  describe('step 1-3: Create and Verify Profile with Folder', () => {
    it('should create profile and verify it appears in folder', () => {
      // Step 1: Save profile
      saveProfile(testProfile);

      // Step 2: Verify profile exists
      const profiles = getProfiles();
      const savedProfile = profiles.find((p) => p.id === testProfile.id);
      expect(savedProfile).toBeDefined();
      expect(savedProfile?.displayName).toBe('Test E2E Profile');
      expect(savedProfile?.folderId).toBe(testFolder.id);
      expect(savedProfile?.tags).toEqual(['e2e', 'testing']);
      expect(savedProfile?.notes).toBe('E2E test profile');

      // Step 3: Verify folder exists
      const folders = getFolders();
      const savedFolder = folders.find((f) => f.id === testFolder.id);
      expect(savedFolder).toBeDefined();
      expect(savedFolder?.name).toBe('Test E2E Folder');
    });

    it('should verify profile metadata is complete', () => {
      saveProfile(testProfile);

      const profiles = getProfiles();
      const savedProfile = profiles.find((p) => p.id === testProfile.id);

      expect(savedProfile).toMatchObject({
        id: testProfile.id,
        path: testProfile.path,
        filename: testProfile.filename,
        displayName: testProfile.displayName,
        folderId: testProfile.folderId,
        tags: testProfile.tags,
        notes: testProfile.notes,
        isSaved: true,
        isEncrypted: false,
        readOnly: false,
      });

      expect(savedProfile?.createdAt).toBeDefined();
      expect(savedProfile?.lastOpened).toBeDefined();
    });
  });

  describe('step 4: Persistence Verification', () => {
    it('should persist profile across store operations', () => {
      // Save profile
      saveProfile(testProfile);

      // Simulate app restart by re-reading from store
      const profilesBefore = getProfiles();
      const profileBefore = profilesBefore.find((p) => p.id === testProfile.id);
      expect(profileBefore).toBeDefined();

      // Verify persistence (in real scenario, this would be after app restart)
      const profilesAfter = getProfiles();
      const profileAfter = profilesAfter.find((p) => p.id === testProfile.id);

      expect(profileAfter).toBeDefined();
      expect(profileAfter).toEqual(profileBefore);
    });
  });

  describe('step 6: Export Profiles', () => {
    it('should export profile to JSON format', () => {
      saveProfile(testProfile);

      // Export profile
      const exportData = exportProfiles([testProfile.id], [testFolder.id]);

      expect(exportData.profiles).toHaveLength(1);
      expect(exportData.folders).toHaveLength(1);
      expect(exportData.version).toBe('1.0.0');
      expect(exportData.exportedAt).toBeDefined();

      // Verify exported profile data
      const exportedProfile = exportData.profiles[0];
      expect(exportedProfile.id).toBe(testProfile.id);
      expect(exportedProfile.displayName).toBe('Test E2E Profile');
      expect(exportedProfile.folderId).toBe(testFolder.id);
      expect(exportedProfile.tags).toEqual(['e2e', 'testing']);
      expect(exportedProfile.notes).toBe('E2E test profile');
    });

    it('should serialize export data to JSON string', () => {
      saveProfile(testProfile);

      const exportData = exportProfiles([testProfile.id], [testFolder.id]);
      const jsonString = serializeExportData(exportData, true);

      // Verify it's valid JSON
      expect(() => JSON.parse(jsonString)).not.toThrow();

      // Verify structure
      const parsed = JSON.parse(jsonString);
      expect(parsed.version).toBe('1.0.0');
      expect(parsed.profiles).toHaveLength(1);
      expect(parsed.folders).toHaveLength(1);
    });

    it('should NOT include passwords in export (security requirement)', () => {
      // Create encrypted profile
      const encryptedProfile: ConnectionProfile = {
        ...testProfile,
        isEncrypted: true,
      };
      saveProfile(encryptedProfile);

      // Export profile
      const exportData = exportProfiles([encryptedProfile.id], [testFolder.id]);
      const jsonString = serializeExportData(exportData, false);

      // Verify password is not in the export
      expect(jsonString).not.toContain('password');
      expect(jsonString).not.toContain('encryptedPassword');

      // Parse and verify
      const parsed = JSON.parse(jsonString);
      const exportedProfile = parsed.profiles[0];
      expect(exportedProfile.password).toBeUndefined();
      expect(exportedProfile.encryptedPassword).toBeUndefined();
    });
  });

  describe('step 7: Delete Profile', () => {
    it('should delete profile successfully', () => {
      saveProfile(testProfile);

      // Verify profile exists
      let profiles = getProfiles();
      expect(profiles.find((p) => p.id === testProfile.id)).toBeDefined();

      // Delete profile
      deleteProfile(testProfile.id);

      // Verify profile is deleted
      profiles = getProfiles();
      expect(profiles.find((p) => p.id === testProfile.id)).toBeUndefined();
    });

    it('should keep folder even after deleting all profiles (edge case)', () => {
      saveProfile(testProfile);

      // Delete profile
      deleteProfile(testProfile.id);

      // Verify folder still exists
      const folders = getFolders();
      expect(folders.find((f) => f.id === testFolder.id)).toBeDefined();
    });
  });

  describe('step 8: Import Profiles', () => {
    it('should parse valid import data', () => {
      const exportData = exportProfiles([testProfile.id], [testFolder.id]);
      const jsonString = serializeExportData(exportData, false);

      // Parse import data
      const parseResult = parseImportData(jsonString);

      expect(parseResult.profiles).toHaveLength(1);
      expect(parseResult.folders).toHaveLength(1);
      expect(parseResult.version).toBe('1.0.0');
    });

    it('should reject invalid JSON', () => {
      expect(() => parseImportData('invalid json')).toThrow('Invalid JSON');
    });

    it('should import profiles successfully with merge option', () => {
      saveProfile(testProfile);

      // Export
      const exportData = exportProfiles([testProfile.id], [testFolder.id]);
      const jsonString = serializeExportData(exportData, false);

      // Delete profile
      deleteProfile(testProfile.id);
      deleteFolder(testFolder.id);

      // Verify deleted
      expect(
        getProfiles().find((p) => p.id === testProfile.id)
      ).toBeUndefined();

      // Import with merge
      const parsedData = parseImportData(jsonString);
      const importResult = importProfiles(parsedData, { merge: true });

      expect(importResult.importedCount).toBe(1);
      expect(importResult.skippedCount).toBe(0);
    });

    it('should skip duplicates when using skip mode', () => {
      saveProfile(testProfile);

      // Export
      const exportData = exportProfiles([testProfile.id], [testFolder.id]);
      const jsonString = serializeExportData(exportData, false);

      // Import with skip mode (profile already exists)
      const parsedData = parseImportData(jsonString);
      const importResult = importProfiles(parsedData, { merge: false });

      expect(importResult.importedCount).toBe(0);
      expect(importResult.skippedCount).toBe(1);
    });
  });

  describe('step 9: Verify Profile Restored (Without Password)', () => {
    it('should restore profile with all metadata except password', () => {
      // Save encrypted profile
      const encryptedProfile: ConnectionProfile = {
        ...testProfile,
        isEncrypted: true,
      };
      saveProfile(encryptedProfile);

      // Export
      const exportData = exportProfiles([encryptedProfile.id], [testFolder.id]);
      const jsonString = serializeExportData(exportData, false);

      // Delete
      deleteProfile(encryptedProfile.id);
      deleteFolder(testFolder.id);

      // Import
      const parsedData = parseImportData(jsonString);
      importProfiles(parsedData, { merge: true });

      // Verify restored profile
      const profiles = getProfiles();
      const restoredProfile = profiles.find(
        (p) => p.id === encryptedProfile.id
      );

      expect(restoredProfile).toBeDefined();
      expect(restoredProfile?.displayName).toBe('Test E2E Profile');
      expect(restoredProfile?.folderId).toBe(testFolder.id);
      expect(restoredProfile?.tags).toEqual(['e2e', 'testing']);
      expect(restoredProfile?.notes).toBe('E2E test profile');
      expect(restoredProfile?.isEncrypted).toBe(true);

      // CRITICAL: Verify password NOT restored
      expect(restoredProfile).not.toHaveProperty('password');
      expect(restoredProfile).not.toHaveProperty('encryptedPassword');
    });
  });

  describe('full E2E Flow', () => {
    it('should complete the entire profile lifecycle', () => {
      // Step 1-3: Create and verify
      saveProfile(testProfile);
      let profiles = getProfiles();
      expect(profiles.find((p) => p.id === testProfile.id)).toBeDefined();

      // Step 4: Verify persistence
      const folders = getFolders();
      expect(folders.find((f) => f.id === testFolder.id)).toBeDefined();

      // Step 6: Export
      const exportData = exportProfiles([testProfile.id], [testFolder.id]);
      expect(exportData.profiles).toHaveLength(1);
      expect(exportData.folders).toHaveLength(1);

      const jsonString = serializeExportData(exportData, false);

      // Verify no passwords in export
      expect(jsonString).not.toContain('password');

      // Step 7: Delete
      deleteProfile(testProfile.id);
      deleteFolder(testFolder.id);
      profiles = getProfiles();
      expect(profiles.find((p) => p.id === testProfile.id)).toBeUndefined();

      // Step 8: Import
      const parsedData = parseImportData(jsonString);
      importProfiles(parsedData, { merge: true });

      // Step 9: Verify restoration
      profiles = getProfiles();
      const restoredProfile = profiles.find((p) => p.id === testProfile.id);
      expect(restoredProfile).toBeDefined();
      expect(restoredProfile?.displayName).toBe('Test E2E Profile');
      expect(restoredProfile?.tags).toEqual(['e2e', 'testing']);

      // Folder also restored
      const restoredFolders = getFolders();
      expect(restoredFolders.find((f) => f.id === testFolder.id)).toBeDefined();
    });
  });

  describe('edge Cases', () => {
    it('should handle empty folder (not auto-delete)', () => {
      saveProfile(testProfile);
      deleteProfile(testProfile.id);

      const folders = getFolders();
      expect(folders.find((f) => f.id === testFolder.id)).toBeDefined();
    });

    it('should handle profile without folder (orphaned profile)', () => {
      const orphanedProfile: ConnectionProfile = {
        ...testProfile,
        folderId: undefined,
      };
      saveProfile(orphanedProfile);

      const profiles = getProfiles();
      const savedProfile = profiles.find((p) => p.id === orphanedProfile.id);
      expect(savedProfile).toBeDefined();
      expect(savedProfile?.folderId).toBeUndefined();
    });

    it('should handle export of all profiles when no IDs provided', () => {
      saveProfile(testProfile);

      // Export all (pass undefined/empty arrays)
      const exportData = exportProfiles();

      // Should include our test profile
      expect(exportData.profiles.length).toBeGreaterThanOrEqual(1);
      expect(
        exportData.profiles.find((p) => p.id === testProfile.id)
      ).toBeDefined();
    });

    it('should validate import schema and reject invalid data', () => {
      const invalidJson = JSON.stringify({
        version: '1.0.0',
        profiles: [
          {
            id: 'invalid-uuid-format',
            // Missing required fields
          },
        ],
      });

      expect(() => parseImportData(invalidJson)).toThrow();
    });
  });
});
