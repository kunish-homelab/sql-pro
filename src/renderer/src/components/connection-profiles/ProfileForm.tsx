import type { ConnectionProfile, ProfileFolder } from '@shared/types.ts';
import { Info } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { sqlPro } from '@/lib/api';
import { cn } from '@/lib/utils';

export interface ProfileFormData {
  displayName: string;
  folderId?: string;
  tags?: string[];
  notes?: string;
  readOnly: boolean;
  rememberPassword: boolean;
}

export interface ProfileFormProps {
  /** Mode: 'new' for new profiles, 'edit' for existing ones */
  mode?: 'new' | 'edit';
  /** Initial values for edit mode */
  initialValues?: Partial<ConnectionProfile>;
  /** Database path - used for password storage check */
  dbPath: string;
  /** Original filename from path - used as default displayName */
  filename: string;
  /** Whether the database is encrypted */
  isEncrypted: boolean;
  /** Available folders for selection */
  folders?: ProfileFolder[];
  /** Callback when form is submitted */
  onSubmit: (data: ProfileFormData) => void;
  /** Callback when form is cancelled */
  onCancel: () => void;
}

const MAX_DISPLAY_NAME_LENGTH = 100;
const MAX_NOTES_LENGTH = 500;

export function ProfileForm({
  mode = 'new',
  initialValues,
  dbPath: _dbPath,
  filename,
  isEncrypted,
  folders = [],
  onSubmit,
  onCancel,
}: ProfileFormProps) {
  // Initialize form state from props
  const [displayName, setDisplayName] = useState(
    initialValues?.displayName ?? filename
  );
  const [folderId, setFolderId] = useState<string | undefined>(
    initialValues?.folderId
  );
  const [tags, setTags] = useState(initialValues?.tags?.join(', ') ?? '');
  const [notes, setNotes] = useState(initialValues?.notes ?? '');
  const [readOnly, setReadOnly] = useState(initialValues?.readOnly ?? false);
  const [rememberPassword, setRememberPassword] = useState(
    initialValues?.rememberPassword ?? false
  );
  const [isStorageAvailable, setIsStorageAvailable] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{
    displayName?: string;
    notes?: string;
  }>({});

  // Check if password storage is available
  useEffect(() => {
    if (isEncrypted) {
      sqlPro.password.isAvailable().then((result: { available: boolean }) => {
        setIsStorageAvailable(result.available);
        // Default to remember if storage is available and this is a new profile
        if (mode === 'new' && result.available && !initialValues) {
          setRememberPassword(true);
        }
      });
    }
  }, [isEncrypted, mode, initialValues]);

  const validateDisplayName = (value: string): string | null => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return 'Display name cannot be empty';
    }
    if (trimmed.length > MAX_DISPLAY_NAME_LENGTH) {
      return `Display name cannot exceed ${MAX_DISPLAY_NAME_LENGTH} characters`;
    }
    return null;
  };

  const validateNotes = (value: string): string | null => {
    if (value.length > MAX_NOTES_LENGTH) {
      return `Notes cannot exceed ${MAX_NOTES_LENGTH} characters`;
    }
    return null;
  };

  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value);
    const error = validateDisplayName(value);
    setValidationErrors((prev) => ({
      ...prev,
      displayName: error ?? undefined,
    }));
  };

  const handleNotesChange = (value: string) => {
    setNotes(value);
    const error = validateNotes(value);
    setValidationErrors((prev) => ({
      ...prev,
      notes: error ?? undefined,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const displayNameError = validateDisplayName(displayName);
    const notesError = validateNotes(notes);

    if (displayNameError || notesError) {
      setValidationErrors({
        displayName: displayNameError ?? undefined,
        notes: notesError ?? undefined,
      });
      return;
    }

    // Parse tags from comma-separated string
    const parsedTags = tags
      .split(',')
      .map((tag: string) => tag.trim())
      .filter((tag: string) => tag.length > 0);

    onSubmit({
      displayName: displayName.trim(),
      folderId: folderId || undefined,
      tags: parsedTags.length > 0 ? parsedTags : undefined,
      notes: notes.trim() || undefined,
      readOnly,
      rememberPassword: isEncrypted && rememberPassword && isStorageAvailable,
    });
  };

  const isValid = !validationErrors.displayName && !validationErrors.notes;
  const submitLabel = mode === 'new' ? 'Save Profile' : 'Save Changes';

  // Build folder hierarchy for display
  const rootFolders = folders.filter((f) => !f.parentId);
  const getFolderPath = (folder: ProfileFolder): string => {
    const parts: string[] = [folder.name];
    let current = folder;
    while (current.parentId) {
      const parent = folders.find((f) => f.id === current.parentId);
      if (!parent) break;
      parts.unshift(parent.name);
      current = parent;
    }
    return parts.join(' / ');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Display Name */}
      <div className="space-y-2">
        <label htmlFor="displayName" className="text-sm font-medium">
          Display Name <span className="text-destructive">*</span>
        </label>
        <input
          id="displayName"
          type="text"
          value={displayName}
          onChange={(e) => handleDisplayNameChange(e.target.value)}
          placeholder="Enter a name for this profile"
          autoFocus
          className={cn(
            'bg-background w-full rounded-md border px-3 py-2 text-sm',
            'placeholder:text-muted-foreground',
            'focus:ring-ring focus:ring-2 focus:ring-offset-2 focus:outline-none',
            validationErrors.displayName ? 'border-destructive' : 'border-input'
          )}
        />
        {validationErrors.displayName && (
          <p className="text-destructive text-xs">
            {validationErrors.displayName}
          </p>
        )}
        <p className="text-muted-foreground text-xs">
          {displayName.trim().length}/{MAX_DISPLAY_NAME_LENGTH} characters
        </p>
      </div>

      {/* Folder Selection */}
      <div className="space-y-2">
        <label htmlFor="folder" className="text-sm font-medium">
          Folder <span className="text-muted-foreground">(optional)</span>
        </label>
        <Select
          value={folderId ?? ''}
          onValueChange={(value) => setFolderId(value || undefined)}
        >
          <SelectTrigger id="folder" className="w-full">
            <SelectValue placeholder="No folder (root level)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">No folder (root level)</SelectItem>
            {rootFolders.map((folder) => (
              <SelectItem key={folder.id} value={folder.id}>
                {getFolderPath(folder)}
              </SelectItem>
            ))}
            {folders
              .filter((f) => f.parentId)
              .map((folder) => (
                <SelectItem key={folder.id} value={folder.id}>
                  {getFolderPath(folder)}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          Organize profiles into folders for better management
        </p>
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <label htmlFor="tags" className="text-sm font-medium">
          Tags <span className="text-muted-foreground">(optional)</span>
        </label>
        <input
          id="tags"
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="production, backup, testing"
          className={cn(
            'bg-background w-full rounded-md border px-3 py-2 text-sm',
            'placeholder:text-muted-foreground',
            'focus:ring-ring focus:ring-2 focus:ring-offset-2 focus:outline-none',
            'border-input'
          )}
        />
        <p className="text-muted-foreground text-xs">
          Separate tags with commas for categorization and search
        </p>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <label htmlFor="notes" className="text-sm font-medium">
          Notes <span className="text-muted-foreground">(optional)</span>
        </label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Add notes about this connection..."
          className={cn(validationErrors.notes ? 'border-destructive' : '')}
          rows={3}
        />
        {validationErrors.notes && (
          <p className="text-destructive text-xs">{validationErrors.notes}</p>
        )}
        <p className="text-muted-foreground text-xs">
          {notes.length}/{MAX_NOTES_LENGTH} characters
        </p>
      </div>

      {/* Read-Only Checkbox */}
      <label className="border-input hover:bg-accent/50 flex cursor-pointer items-center gap-3 rounded-md border p-3">
        <input
          type="checkbox"
          checked={readOnly}
          onChange={(e) => setReadOnly(e.target.checked)}
          className="border-input h-4 w-4 rounded"
        />
        <div className="flex-1">
          <span className="text-sm font-medium">Open in read-only mode</span>
          <p className="text-muted-foreground text-xs">
            Prevents accidental modifications to the database
          </p>
        </div>
      </label>

      {/* Remember Password Checkbox - Only for encrypted databases */}
      {isEncrypted && (
        <label
          className={cn(
            'border-input flex items-center gap-3 rounded-md border p-3',
            isStorageAvailable
              ? 'hover:bg-accent/50 cursor-pointer'
              : 'cursor-not-allowed opacity-50'
          )}
        >
          <input
            type="checkbox"
            checked={rememberPassword}
            onChange={(e) => setRememberPassword(e.target.checked)}
            disabled={!isStorageAvailable}
            className="border-input h-4 w-4 rounded"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Remember password</span>
              {!isStorageAvailable && (
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="text-muted-foreground h-4 w-4" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">
                      Password storage is not available on this system.
                      Passwords can only be saved if your system supports secure
                      storage (Windows Credential Manager, macOS Keychain, or
                      Linux Secret Service).
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <p className="text-muted-foreground text-xs">
              Store password securely in system keychain for automatic login
            </p>
          </div>
        </label>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!isValid}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
