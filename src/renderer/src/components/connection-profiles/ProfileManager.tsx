import type { ConnectionProfile, ProfileFolder } from '@shared/types.ts';
import type { ProfileFormData } from './ProfileForm';
import {
  AlertTriangle,
  Database,
  FileText,
  FolderPlus,
  KeyRound,
  Search,
  Tag,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { sqlPro } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useConnectionStore } from '@/stores';
import { FolderTree } from './FolderTree';
import { ProfileForm } from './ProfileForm';

export interface ProfileManagerProps {
  /** Callback when a profile is connected */
  onConnect?: (profile: ConnectionProfile) => void;
  /** Whether to show in compact mode (no details panel) */
  compact?: boolean;
}

export function ProfileManager({
  onConnect,
  compact = false,
}: ProfileManagerProps) {
  const {
    profiles,
    folders,
    selectedProfileId,
    expandedFolderIds,
    selectProfile,
    toggleFolderExpanded,
    addProfile,
    updateProfile,
    deleteProfile,
    addFolder,
    updateFolder,
    deleteFolder,
    setProfiles,
    setFolders,
  } = useConnectionStore();

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missingDbPaths, setMissingDbPaths] = useState<Set<string>>(new Set());
  const [keychainAvailable, setKeychainAvailable] = useState<boolean>(true);

  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] =
    useState<ConnectionProfile | null>(null);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderDialogMode, setFolderDialogMode] = useState<'create' | 'rename'>(
    'create'
  );
  const [editingFolder, setEditingFolder] = useState<ProfileFolder | null>(
    null
  );
  const [folderName, setFolderName] = useState('');

  // Check if keychain is available
  const checkKeychainAvailability = useCallback(async () => {
    try {
      // Use a test operation to check if keychain is available
      await sqlPro.password.has({
        dbPath: '__keychain_test__',
      });
      setKeychainAvailable(true);
    } catch {
      setKeychainAvailable(false);
    }
  }, []);

  // Validate database file existence for profiles
  const validateDatabaseFiles = async (profilesList: ConnectionProfile[]) => {
    const missing = new Set<string>();

    for (const profile of profilesList) {
      try {
        // Check if file exists using Node.js fs API through main process
        const exists = await sqlPro.file?.exists({ path: profile.path });
        if (exists && !exists.exists) {
          missing.add(profile.path);
        }
      } catch {
        // If file check fails, don't mark as missing (avoid false positives)
      }
    }

    setMissingDbPaths(missing);
  };

  const loadProfilesAndFolders = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load profiles
      const profilesResult = await sqlPro.profile.getAll({});
      if (profilesResult.success && profilesResult.profiles) {
        setProfiles(profilesResult.profiles);
        // Validate database file existence
        await validateDatabaseFiles(profilesResult.profiles);
      } else {
        setError(profilesResult.error || 'Failed to load profiles');
      }

      // Load folders
      const foldersResult = await sqlPro.folder.getAll({});
      if (foldersResult.success && foldersResult.folders) {
        setFolders(foldersResult.folders);
      } else {
        setError(foldersResult.error || 'Failed to load folders');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [setProfiles, setFolders]);

  // Load profiles and folders on mount
  useEffect(() => {
    loadProfilesAndFolders();
    checkKeychainAvailability();
  }, [loadProfilesAndFolders, checkKeychainAvailability]);

  // Filter profiles based on search query
  const filteredProfiles = Array.from(profiles.values()).filter((profile) => {
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();
    const displayName = (profile.displayName || profile.filename).toLowerCase();
    const path = profile.path.toLowerCase();
    const notes = (profile.notes || '').toLowerCase();
    const tags = (profile.tags || []).join(' ').toLowerCase();

    return (
      displayName.includes(query) ||
      path.includes(query) ||
      notes.includes(query) ||
      tags.includes(query)
    );
  });

  // Separate recent connections (unsaved profiles) from saved profiles
  const recentProfiles = filteredProfiles.filter((p) => !p.isSaved);
  const savedProfiles = filteredProfiles.filter((p) => p.isSaved);

  // Handle profile connection
  const handleConnectProfile = useCallback(
    async (profile: ConnectionProfile) => {
      if (onConnect) {
        onConnect(profile);
      }
    },
    [onConnect]
  );

  // Handle profile edit
  const handleEditProfile = useCallback((profile: ConnectionProfile) => {
    setEditingProfile(profile);
    setEditDialogOpen(true);
  }, []);

  // Handle profile duplicate
  const handleDuplicateProfile = useCallback(
    async (profile: ConnectionProfile) => {
      // Check if database file exists
      if (missingDbPaths.has(profile.path)) {
        setError(
          `Cannot duplicate profile: Database file not found at ${profile.path}. Please ensure the file exists before duplicating.`
        );
        return;
      }

      const duplicatedProfile: ConnectionProfile = {
        ...profile,
        id: crypto.randomUUID(),
        displayName: `${profile.displayName || profile.filename} (Copy)`,
        isSaved: true,
        createdAt: new Date().toISOString(),
        lastOpened: undefined,
      };

      try {
        const result = await sqlPro.profile.save({
          profile: duplicatedProfile,
        });

        if (result.success && result.profile) {
          addProfile(result.profile);
        } else {
          const errorMsg = result.error || 'Failed to duplicate profile';
          if (errorMsg.includes('keychain') || errorMsg.includes('password')) {
            setError(
              `${errorMsg}${!keychainAvailable ? ' (Keychain is unavailable on this system)' : ''}`
            );
          } else {
            setError(errorMsg);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    },
    [addProfile, missingDbPaths, keychainAvailable]
  );

  // Handle profile delete
  const handleDeleteProfile = useCallback(
    async (profileId: string) => {
      const profile = profiles.get(profileId);
      if (!profile) return;

      if (
        // eslint-disable-next-line no-alert -- Simple confirmation for delete action
        !confirm(`Delete profile "${profile.displayName || profile.filename}"?`)
      ) {
        return;
      }

      try {
        const result = await sqlPro.profile.delete({
          id: profileId,
          removePassword: true, // Also remove password from keychain
        });

        if (result.success) {
          deleteProfile(profileId);
          if (selectedProfileId === profileId) {
            selectProfile(null);
          }
        } else {
          setError(result.error || 'Failed to delete profile');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    },
    [profiles, selectedProfileId, deleteProfile, selectProfile]
  );

  // Handle profile form submit
  const handleProfileFormSubmit = useCallback(
    async (data: ProfileFormData) => {
      if (!editingProfile) return;

      try {
        const result = await sqlPro.profile.update({
          id: editingProfile.id,
          updates: {
            displayName: data.displayName,
            folderId: data.folderId,
            tags: data.tags,
            notes: data.notes,
            readOnly: data.readOnly,
            rememberPassword: data.rememberPassword,
            isSaved: true, // Mark as saved when edited
          },
        });

        if (result.success && result.profile) {
          updateProfile(editingProfile.id, result.profile);
          setEditDialogOpen(false);
          setEditingProfile(null);
        } else {
          setError(result.error || 'Failed to update profile');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    },
    [editingProfile, updateProfile]
  );

  // Handle folder create
  const handleCreateFolder = useCallback(
    (parentId?: string) => {
      setFolderDialogMode('create');
      setEditingFolder(parentId ? folders.get(parentId) || null : null);
      setFolderName('');
      setFolderDialogOpen(true);
    },
    [folders]
  );

  // Handle folder rename
  const handleRenameFolder = useCallback(
    (folderId: string) => {
      const folder = folders.get(folderId);
      if (!folder) return;

      setFolderDialogMode('rename');
      setEditingFolder(folder);
      setFolderName(folder.name);
      setFolderDialogOpen(true);
    },
    [folders]
  );

  // Handle folder delete
  const handleDeleteFolder = useCallback(
    async (folderId: string) => {
      const folder = folders.get(folderId);
      if (!folder) return;

      // Check if folder has subfolders or profiles
      const hasSubfolders = Array.from(folders.values()).some(
        (f) => f.parentId === folderId
      );
      const hasProfiles = Array.from(profiles.values()).some(
        (p) => p.folderId === folderId
      );

      if (hasSubfolders || hasProfiles) {
        if (
          // eslint-disable-next-line no-alert -- Simple confirmation for delete action
          !confirm(
            `Folder "${folder.name}" contains ${hasSubfolders ? 'subfolders' : ''}${hasSubfolders && hasProfiles ? ' and ' : ''}${hasProfiles ? 'profiles' : ''}. Delete anyway? Contents will be moved to root level.`
          )
        ) {
          return;
        }
      } else {
        // eslint-disable-next-line no-alert -- Simple confirmation for delete action
        if (!confirm(`Delete folder "${folder.name}"?`)) {
          return;
        }
      }

      try {
        const result = await sqlPro.folder.delete({ id: folderId });

        if (result.success) {
          deleteFolder(folderId);
          // Move child folders to parent
          Array.from(folders.values())
            .filter((f) => f.parentId === folderId)
            .forEach((f) => {
              updateFolder(f.id, { parentId: folder.parentId });
            });
          // Move profiles to root
          Array.from(profiles.values())
            .filter((p) => p.folderId === folderId)
            .forEach((p) => {
              updateProfile(p.id, { folderId: undefined });
            });
        } else {
          setError(result.error || 'Failed to delete folder');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    },
    [folders, profiles, deleteFolder, updateFolder, updateProfile]
  );

  // Handle folder dialog submit
  const handleFolderDialogSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const trimmedName = folderName.trim();
      if (!trimmedName) {
        setError('Folder name cannot be empty');
        return;
      }

      // Validate folder name length
      if (trimmedName.length > 100) {
        setError('Folder name must be 100 characters or less');
        return;
      }

      // Check for duplicate folder names at the same level
      const parentId = editingFolder?.id;
      const siblingFolders = Array.from(folders.values()).filter(
        (f) =>
          f.parentId === parentId &&
          (folderDialogMode === 'create' || f.id !== editingFolder?.id)
      );

      const duplicateName = siblingFolders.some(
        (f) => f.name.toLowerCase() === trimmedName.toLowerCase()
      );

      if (duplicateName) {
        setError(
          `A folder named "${trimmedName}" already exists at this level. Please choose a different name.`
        );
        return;
      }

      if (folderDialogMode === 'create') {
        // Create new folder
        try {
          const result = await sqlPro.folder.create({
            name: trimmedName,
            parentId: editingFolder?.id,
          });

          if (result.success && result.folder) {
            addFolder(result.folder);
            setFolderDialogOpen(false);
            setFolderName('');
            setEditingFolder(null);
            setError(null); // Clear any previous errors
          } else {
            setError(result.error || 'Failed to create folder');
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          setError(`Failed to create folder: ${errorMsg}`);
        }
      } else {
        // Rename existing folder
        if (!editingFolder) return;

        try {
          const result = await sqlPro.folder.update({
            id: editingFolder.id,
            updates: { name: trimmedName },
          });

          if (result.success && result.folder) {
            updateFolder(editingFolder.id, { name: trimmedName });
            setFolderDialogOpen(false);
            setFolderName('');
            setEditingFolder(null);
            setError(null); // Clear any previous errors
          } else {
            setError(result.error || 'Failed to rename folder');
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          setError(`Failed to rename folder: ${errorMsg}`);
        }
      }
    },
    [
      folderDialogMode,
      folderName,
      editingFolder,
      folders,
      addFolder,
      updateFolder,
    ]
  );

  // Handle drag and drop
  const handleDropOnFolder = useCallback(
    async (profileId: string, folderId: string | undefined) => {
      const profile = profiles.get(profileId);
      if (!profile) return;

      // Don't update if already in the same folder
      if (profile.folderId === folderId) return;

      try {
        const result = await sqlPro.profile.update({
          id: profileId,
          updates: { folderId },
        });

        if (result.success && result.profile) {
          updateProfile(profileId, { folderId });
        } else {
          setError(result.error || 'Failed to move profile');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    },
    [profiles, updateProfile]
  );

  // Get selected profile for details panel
  const selectedProfile = selectedProfileId
    ? profiles.get(selectedProfileId)
    : null;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Connection Profiles</h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleCreateFolder()}
          >
            <FolderPlus className="size-4" />
            New Folder
          </Button>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            type="text"
            placeholder="Search profiles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-9 pl-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={cn('flex flex-1 overflow-hidden', !compact && 'gap-4')}>
        {/* Profile list */}
        <div className={cn('flex-1 overflow-auto p-4', !compact && 'w-2/3')}>
          {isLoading ? (
            <div className="text-muted-foreground flex h-full items-center justify-center">
              Loading profiles...
            </div>
          ) : error ? (
            <div className="text-destructive flex h-full items-center justify-center">
              {error}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Recent connections */}
              {recentProfiles.length > 0 && (
                <div>
                  <h3 className="text-muted-foreground mb-2 text-xs font-semibold uppercase">
                    Recent Connections
                  </h3>
                  <div className="space-y-1">
                    {recentProfiles.map((profile) => (
                      <div
                        key={profile.id}
                        className={cn(
                          'hover:bg-accent flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors',
                          selectedProfileId === profile.id && 'bg-accent'
                        )}
                        onClick={() => selectProfile(profile.id)}
                        onDoubleClick={() => handleConnectProfile(profile)}
                      >
                        <Database className="text-muted-foreground size-4" />
                        <span className="flex-1 truncate">
                          {profile.displayName || profile.filename}
                        </span>
                        {missingDbPaths.has(profile.path) && (
                          <Tooltip>
                            <TooltipTrigger>
                              <AlertTriangle className="size-4 text-yellow-500" />
                            </TooltipTrigger>
                            <TooltipContent>
                              Database file not found at this location
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {profile.isEncrypted && (
                          <HasSavedPasswordIndicator
                            path={profile.path}
                            keychainAvailable={keychainAvailable}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Saved profiles and folders */}
              {(savedProfiles.length > 0 || folders.size > 0) && (
                <div>
                  <h3 className="text-muted-foreground mb-2 text-xs font-semibold uppercase">
                    Saved Profiles
                  </h3>
                  <FolderTree
                    folders={Array.from(folders.values())}
                    profiles={savedProfiles}
                    expandedFolderIds={expandedFolderIds}
                    selectedProfileId={selectedProfileId}
                    onToggleFolder={toggleFolderExpanded}
                    onSelectProfile={selectProfile}
                    onConnectProfile={handleConnectProfile}
                    onCreateFolder={handleCreateFolder}
                    onRenameFolder={handleRenameFolder}
                    onDeleteFolder={handleDeleteFolder}
                    onDeleteProfile={handleDeleteProfile}
                    onEditProfile={handleEditProfile}
                    onDuplicateProfile={handleDuplicateProfile}
                    onDropOnFolder={handleDropOnFolder}
                  />
                </div>
              )}

              {/* Empty state */}
              {recentProfiles.length === 0 &&
                savedProfiles.length === 0 &&
                folders.size === 0 && (
                  <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 text-center">
                    <Database className="size-12" />
                    <p className="text-sm">
                      {searchQuery
                        ? 'No profiles found matching your search'
                        : 'No connection profiles yet'}
                    </p>
                    {!searchQuery && (
                      <p className="text-xs">
                        Connect to a database and save it as a profile to get
                        started
                      </p>
                    )}
                  </div>
                )}
            </div>
          )}
        </div>

        {/* Details panel */}
        {!compact && (
          <div className="w-1/3 overflow-auto border-l p-4">
            {selectedProfile ? (
              <div className="space-y-4">
                <div>
                  <h3 className="mb-2 font-semibold">
                    {selectedProfile.displayName || selectedProfile.filename}
                  </h3>
                  <p className="text-muted-foreground text-xs">
                    {selectedProfile.path}
                  </p>
                </div>

                {/* Details */}
                <div className="space-y-3">
                  {/* Tags */}
                  {selectedProfile.tags && selectedProfile.tags.length > 0 && (
                    <div>
                      <div className="text-muted-foreground mb-1 flex items-center gap-1 text-xs font-medium">
                        <Tag className="size-3" />
                        Tags
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {selectedProfile.tags.map((tag) => (
                          <span
                            key={tag}
                            className="bg-accent rounded-full px-2 py-0.5 text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {selectedProfile.notes && (
                    <div>
                      <div className="text-muted-foreground mb-1 flex items-center gap-1 text-xs font-medium">
                        <FileText className="size-3" />
                        Notes
                      </div>
                      <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                        {selectedProfile.notes}
                      </p>
                    </div>
                  )}

                  {/* Properties */}
                  <div>
                    <div className="text-muted-foreground mb-1 text-xs font-medium">
                      Properties
                    </div>
                    <div className="space-y-1 text-xs">
                      {selectedProfile.isEncrypted && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">
                            Encrypted:
                          </span>
                          <span>Yes</span>
                        </div>
                      )}
                      {selectedProfile.readOnly && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">
                            Read-only:
                          </span>
                          <span>Yes</span>
                        </div>
                      )}
                      {selectedProfile.lastOpened && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">
                            Last opened:
                          </span>
                          <span>
                            {new Date(
                              selectedProfile.lastOpened
                            ).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-2">
                  <Button
                    className="w-full"
                    onClick={() => handleConnectProfile(selectedProfile)}
                  >
                    Connect
                  </Button>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => handleEditProfile(selectedProfile)}
                  >
                    Edit Profile
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground flex h-full items-center justify-center text-center text-sm">
                Select a profile to view details
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          {editingProfile && (
            <ProfileForm
              mode="edit"
              initialValues={editingProfile}
              dbPath={editingProfile.path}
              filename={editingProfile.filename}
              isEncrypted={editingProfile.isEncrypted}
              folders={Array.from(folders.values())}
              onSubmit={handleProfileFormSubmit}
              onCancel={() => {
                setEditDialogOpen(false);
                setEditingProfile(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Folder Dialog */}
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {folderDialogMode === 'create'
                ? 'Create Folder'
                : 'Rename Folder'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleFolderDialogSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="folderName" className="text-sm font-medium">
                Folder Name
              </label>
              <Input
                id="folderName"
                type="text"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="Enter folder name"
                autoFocus
              />
              {editingFolder && folderDialogMode === 'create' && (
                <p className="text-muted-foreground text-xs">
                  Creating subfolder in: {editingFolder.name}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFolderDialogOpen(false);
                  setFolderName('');
                  setEditingFolder(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit">
                {folderDialogMode === 'create' ? 'Create' : 'Rename'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Check if a database has a saved password
function HasSavedPasswordIndicator({
  path,
  keychainAvailable = true,
}: {
  path: string;
  keychainAvailable?: boolean;
}) {
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    sqlPro.password
      .has({ dbPath: path })
      .then((result: { hasPassword: boolean }) => {
        setHasSaved(result.hasPassword);
      })
      .catch(() => {
        setHasSaved(false);
      });
  }, [path]);

  if (!hasSaved) return null;

  return (
    <Tooltip>
      <TooltipTrigger>
        <KeyRound
          className={cn(
            'size-3',
            keychainAvailable ? 'text-green-500' : 'text-yellow-500'
          )}
        />
      </TooltipTrigger>
      <TooltipContent>
        {keychainAvailable
          ? 'Password saved'
          : 'Password saved (keychain may be unavailable)'}
      </TooltipContent>
    </Tooltip>
  );
}
