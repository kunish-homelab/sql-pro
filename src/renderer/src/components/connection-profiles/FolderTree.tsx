import type { ConnectionProfile, ProfileFolder } from '@shared/types.ts';
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';

export interface FolderTreeProps {
  /** All available folders */
  folders: ProfileFolder[];
  /** All available profiles */
  profiles: ConnectionProfile[];
  /** Set of expanded folder IDs */
  expandedFolderIds: Set<string>;
  /** Selected profile ID */
  selectedProfileId: string | null;
  /** Callback when a folder is toggled */
  onToggleFolder: (folderId: string) => void;
  /** Callback when a profile is selected */
  onSelectProfile: (profileId: string) => void;
  /** Callback when a profile is double-clicked to connect */
  onConnectProfile: (profile: ConnectionProfile) => void;
  /** Callback when creating a new folder */
  onCreateFolder: (parentId?: string) => void;
  /** Callback when renaming a folder */
  onRenameFolder: (folderId: string) => void;
  /** Callback when deleting a folder */
  onDeleteFolder: (folderId: string) => void;
  /** Callback when deleting a profile */
  onDeleteProfile: (profileId: string) => void;
  /** Callback when editing a profile */
  onEditProfile: (profile: ConnectionProfile) => void;
  /** Callback when duplicating a profile */
  onDuplicateProfile: (profile: ConnectionProfile) => void;
  /** Callback when drag starts */
  onDragStart?: (profileId: string) => void;
  /** Callback when drop occurs on folder */
  onDropOnFolder?: (profileId: string, folderId: string | undefined) => void;
}

interface FolderNodeProps {
  folder: ProfileFolder;
  level: number;
  subfolders: ProfileFolder[];
  profiles: ConnectionProfile[];
  expandedFolderIds: Set<string>;
  selectedProfileId: string | null;
  onToggleFolder: (folderId: string) => void;
  onSelectProfile: (profileId: string) => void;
  onConnectProfile: (profile: ConnectionProfile) => void;
  onCreateFolder: (parentId?: string) => void;
  onRenameFolder: (folderId: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onDeleteProfile: (profileId: string) => void;
  onEditProfile: (profile: ConnectionProfile) => void;
  onDuplicateProfile: (profile: ConnectionProfile) => void;
  onDragStart?: (profileId: string) => void;
  onDropOnFolder?: (profileId: string, folderId: string | undefined) => void;
  allFolders: ProfileFolder[];
  allProfiles: ConnectionProfile[];
}

function FolderNode({
  folder,
  level,
  subfolders,
  profiles,
  expandedFolderIds,
  selectedProfileId,
  onToggleFolder,
  onSelectProfile,
  onConnectProfile,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onDeleteProfile,
  onEditProfile,
  onDuplicateProfile,
  onDragStart,
  onDropOnFolder,
  allFolders,
  allProfiles,
}: FolderNodeProps) {
  const isExpanded = expandedFolderIds.has(folder.id);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const profileId = e.dataTransfer.getData('profileId');
    if (profileId && onDropOnFolder) {
      onDropOnFolder(profileId, folder.id);
    }
  };

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger>
          <Collapsible
            open={isExpanded}
            onOpenChange={() => onToggleFolder(folder.id)}
          >
            <div
              className={cn(
                'hover:bg-accent flex items-center gap-1 rounded-sm px-2 py-1.5 text-sm transition-colors',
                isDragOver && 'bg-accent/50 ring-primary ring-1'
              )}
              style={{ paddingLeft: `${level * 12 + 8}px` }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <CollapsibleTrigger
                className="h-auto w-auto p-0 hover:bg-transparent"
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto w-auto p-0 hover:bg-transparent"
                  >
                    {isExpanded ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                  </Button>
                }
              ></CollapsibleTrigger>
              {isExpanded ? (
                <FolderOpen className="text-muted-foreground size-4" />
              ) : (
                <Folder className="text-muted-foreground size-4" />
              )}
              <span className="flex-1 truncate">{folder.name}</span>
              <span className="text-muted-foreground text-xs">
                {profiles.length + subfolders.length}
              </span>
            </div>

            <CollapsibleContent>
              {/* Render subfolders */}
              {subfolders.map((subfolder) => {
                const subSubfolders = allFolders.filter(
                  (f) => f.parentId === subfolder.id
                );
                const subProfiles = allProfiles.filter(
                  (p) => p.folderId === subfolder.id
                );
                return (
                  <FolderNode
                    key={subfolder.id}
                    folder={subfolder}
                    level={level + 1}
                    subfolders={subSubfolders}
                    profiles={subProfiles}
                    expandedFolderIds={expandedFolderIds}
                    selectedProfileId={selectedProfileId}
                    onToggleFolder={onToggleFolder}
                    onSelectProfile={onSelectProfile}
                    onConnectProfile={onConnectProfile}
                    onCreateFolder={onCreateFolder}
                    onRenameFolder={onRenameFolder}
                    onDeleteFolder={onDeleteFolder}
                    onDeleteProfile={onDeleteProfile}
                    onEditProfile={onEditProfile}
                    onDuplicateProfile={onDuplicateProfile}
                    onDragStart={onDragStart}
                    onDropOnFolder={onDropOnFolder}
                    allFolders={allFolders}
                    allProfiles={allProfiles}
                  />
                );
              })}

              {/* Render profiles in this folder */}
              {profiles.map((profile) => (
                <ProfileNode
                  key={profile.id}
                  profile={profile}
                  level={level + 1}
                  isSelected={selectedProfileId === profile.id}
                  onSelect={onSelectProfile}
                  onConnect={onConnectProfile}
                  onDelete={onDeleteProfile}
                  onEdit={onEditProfile}
                  onDuplicate={onDuplicateProfile}
                  onDragStart={onDragStart}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        </ContextMenuTrigger>

        <ContextMenuContent>
          <ContextMenuItem onClick={() => onCreateFolder(folder.id)}>
            <FolderPlus className="size-4" />
            New Subfolder
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onRenameFolder(folder.id)}>
            <Pencil className="size-4" />
            Rename
          </ContextMenuItem>
          <ContextMenuItem
            variant="destructive"
            onClick={() => onDeleteFolder(folder.id)}
          >
            <Trash2 className="size-4" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}

interface ProfileNodeProps {
  profile: ConnectionProfile;
  level: number;
  isSelected: boolean;
  onSelect: (profileId: string) => void;
  onConnect: (profile: ConnectionProfile) => void;
  onDelete: (profileId: string) => void;
  onEdit: (profile: ConnectionProfile) => void;
  onDuplicate: (profile: ConnectionProfile) => void;
  onDragStart?: (profileId: string) => void;
}

function ProfileNode({
  profile,
  level,
  isSelected,
  onSelect,
  onConnect,
  onDelete,
  onEdit,
  onDuplicate,
  onDragStart,
}: ProfileNodeProps) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('profileId', profile.id);
    if (onDragStart) {
      onDragStart(profile.id);
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          draggable
          onDragStart={handleDragStart}
          className={cn(
            'hover:bg-accent flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors',
            isSelected && 'bg-accent'
          )}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
          onClick={() => onSelect(profile.id)}
          onDoubleClick={() => onConnect(profile)}
        >
          <div className="ml-4 flex-1 truncate">
            <div className="flex items-center gap-2">
              <span>{profile.displayName || profile.filename}</span>
              {profile.isEncrypted && (
                <span className="text-muted-foreground text-xs">🔒</span>
              )}
              {profile.readOnly && (
                <span className="text-muted-foreground text-xs">👁</span>
              )}
            </div>
            {profile.notes && (
              <div className="text-muted-foreground truncate text-xs">
                {profile.notes}
              </div>
            )}
          </div>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuItem onClick={() => onConnect(profile)}>
          Connect
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onEdit(profile)}>
          <Pencil className="size-4" />
          Edit
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onDuplicate(profile)}>
          Duplicate
        </ContextMenuItem>
        <ContextMenuItem
          variant="destructive"
          onClick={() => onDelete(profile.id)}
        >
          <Trash2 className="size-4" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function FolderTree({
  folders,
  profiles,
  expandedFolderIds,
  selectedProfileId,
  onToggleFolder,
  onSelectProfile,
  onConnectProfile,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onDeleteProfile,
  onEditProfile,
  onDuplicateProfile,
  onDragStart,
  onDropOnFolder,
}: FolderTreeProps) {
  const [isDragOverRoot, setIsDragOverRoot] = useState(false);

  // Get root folders (folders with no parent)
  const rootFolders = folders.filter((f) => !f.parentId);

  // Get root profiles (profiles with no folder)
  const rootProfiles = profiles.filter((p) => !p.folderId);

  const handleRootDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverRoot(true);
  };

  const handleRootDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverRoot(false);
  };

  const handleRootDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverRoot(false);

    const profileId = e.dataTransfer.getData('profileId');
    if (profileId && onDropOnFolder) {
      onDropOnFolder(profileId, undefined);
    }
  };

  return (
    <div className="space-y-1">
      {/* Root folders */}
      {rootFolders.map((folder) => {
        const subfolders = folders.filter((f) => f.parentId === folder.id);
        const folderProfiles = profiles.filter((p) => p.folderId === folder.id);
        return (
          <FolderNode
            key={folder.id}
            folder={folder}
            level={0}
            subfolders={subfolders}
            profiles={folderProfiles}
            expandedFolderIds={expandedFolderIds}
            selectedProfileId={selectedProfileId}
            onToggleFolder={onToggleFolder}
            onSelectProfile={onSelectProfile}
            onConnectProfile={onConnectProfile}
            onCreateFolder={onCreateFolder}
            onRenameFolder={onRenameFolder}
            onDeleteFolder={onDeleteFolder}
            onDeleteProfile={onDeleteProfile}
            onEditProfile={onEditProfile}
            onDuplicateProfile={onDuplicateProfile}
            onDragStart={onDragStart}
            onDropOnFolder={onDropOnFolder}
            allFolders={folders}
            allProfiles={profiles}
          />
        );
      })}

      {/* Root profiles (no folder) */}
      <div
        className={cn(
          'space-y-1',
          isDragOverRoot && 'bg-accent/50 ring-primary rounded-sm ring-1'
        )}
        onDragOver={handleRootDragOver}
        onDragLeave={handleRootDragLeave}
        onDrop={handleRootDrop}
      >
        {rootProfiles.map((profile) => (
          <ProfileNode
            key={profile.id}
            profile={profile}
            level={0}
            isSelected={selectedProfileId === profile.id}
            onSelect={onSelectProfile}
            onConnect={onConnectProfile}
            onDelete={onDeleteProfile}
            onEdit={onEditProfile}
            onDuplicate={onDuplicateProfile}
            onDragStart={onDragStart}
          />
        ))}
      </div>
    </div>
  );
}
