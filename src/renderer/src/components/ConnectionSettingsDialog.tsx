import { useState, useEffect } from 'react';
import { Settings, Info } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface ConnectionSettings {
  displayName: string;
  readOnly: boolean;
  rememberPassword: boolean;
}

interface ConnectionSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (settings: ConnectionSettings) => void;
  /** Original filename from path - used as default displayName */
  filename: string;
  /** Full database path - used for password storage check */
  dbPath: string;
  /** Whether the database is encrypted */
  isEncrypted: boolean;
  /** Mode: 'new' for new connections, 'edit' for existing ones */
  mode?: 'new' | 'edit';
  /** Initial values for edit mode */
  initialValues?: Partial<ConnectionSettings>;
}

const MAX_DISPLAY_NAME_LENGTH = 100;

interface DialogFormContentProps {
  onOpenChange: (open: boolean) => void;
  onSubmit: (settings: ConnectionSettings) => void;
  filename: string;
  isEncrypted: boolean;
  mode: 'new' | 'edit';
  initialValues?: Partial<ConnectionSettings>;
}

/** Internal form component - mounts fresh each time dialog opens */
function DialogFormContent({
  onOpenChange,
  onSubmit,
  filename,
  isEncrypted,
  mode,
  initialValues,
}: DialogFormContentProps) {
  // State initializes from props - no useEffect needed
  const [displayName, setDisplayName] = useState(
    initialValues?.displayName ?? filename
  );
  const [readOnly, setReadOnly] = useState(initialValues?.readOnly ?? false);
  const [rememberPassword, setRememberPassword] = useState(
    initialValues?.rememberPassword ?? false
  );
  const [isStorageAvailable, setIsStorageAvailable] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Check if password storage is available (async operation is fine in useEffect)
  useEffect(() => {
    if (isEncrypted) {
      window.sqlPro.password.isAvailable().then((result) => {
        setIsStorageAvailable(result.available);
        // Default to remember if storage is available and this is a new connection
        if (
          mode === 'new' &&
          result.available &&
          !initialValues?.rememberPassword
        ) {
          setRememberPassword(true);
        }
      });
    }
  }, [isEncrypted, mode, initialValues?.rememberPassword]);

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

  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value);
    setValidationError(validateDisplayName(value));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const error = validateDisplayName(displayName);
    if (error) {
      setValidationError(error);
      return;
    }

    onSubmit({
      displayName: displayName.trim(),
      readOnly,
      rememberPassword: isEncrypted && rememberPassword && isStorageAvailable,
    });
  };

  const isValid = !validateDisplayName(displayName);
  const dialogTitle =
    mode === 'new' ? 'Connection Settings' : 'Edit Connection';
  const submitLabel = mode === 'new' ? 'Save & Connect' : 'Save Changes';

  return (
    <>
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Settings className="h-6 w-6 text-primary" />
        </div>
        <Dialog.Title className="text-lg font-semibold">
          {dialogTitle}
        </Dialog.Title>
        <Dialog.Description className="mt-2 text-sm text-muted-foreground">
          Configure settings for <span className="font-medium">{filename}</span>
        </Dialog.Description>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {/* Display Name */}
        <div className="space-y-2">
          <label htmlFor="displayName" className="text-sm font-medium">
            Display Name
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => handleDisplayNameChange(e.target.value)}
            placeholder="Enter a name for this connection"
            autoFocus
            className={cn(
              'w-full rounded-md border bg-background px-3 py-2 text-sm',
              'placeholder:text-muted-foreground',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              validationError ? 'border-destructive' : 'border-input'
            )}
          />
          {validationError && (
            <p className="text-xs text-destructive">{validationError}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {displayName.trim().length}/{MAX_DISPLAY_NAME_LENGTH} characters
          </p>
        </div>

        {/* Read-Only Checkbox */}
        <label className="flex cursor-pointer items-center gap-3 rounded-md border border-input p-3 hover:bg-accent/50">
          <input
            type="checkbox"
            checked={readOnly}
            onChange={(e) => setReadOnly(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          <div className="flex-1">
            <span className="text-sm font-medium">Open in read-only mode</span>
            <p className="text-xs text-muted-foreground">
              Prevents accidental modifications to the database
            </p>
          </div>
        </label>

        {/* Remember Password Checkbox - Only for encrypted databases */}
        {isEncrypted && (
          <label
            className={cn(
              'flex items-center gap-3 rounded-md border border-input p-3',
              isStorageAvailable
                ? 'cursor-pointer hover:bg-accent/50'
                : 'cursor-not-allowed opacity-50'
            )}
          >
            <input
              type="checkbox"
              checked={rememberPassword}
              onChange={(e) => setRememberPassword(e.target.checked)}
              disabled={!isStorageAvailable}
              className="h-4 w-4 rounded border-input"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Remember password</span>
                {!isStorageAvailable && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Secure storage is not available on this system</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Securely store password in system keychain
              </p>
            </div>
          </label>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={!isValid}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </>
  );
}

export function ConnectionSettingsDialog({
  open,
  onOpenChange,
  onSubmit,
  filename,
  dbPath: _dbPath, // Reserved for future edit mode (check existing password)
  isEncrypted,
  mode = 'new',
  initialValues,
}: ConnectionSettingsDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          {open && (
            <DialogFormContent
              onOpenChange={onOpenChange}
              onSubmit={onSubmit}
              filename={filename}
              isEncrypted={isEncrypted}
              mode={mode}
              initialValues={initialValues}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
