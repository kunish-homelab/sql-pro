import { useState, useEffect } from 'react';
import { Lock, Info } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface PasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (password: string, rememberPassword: boolean) => void;
  filename: string;
  dbPath: string;
}

export function PasswordDialog({
  open,
  onOpenChange,
  onSubmit,
  filename,
  dbPath,
}: PasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [rememberPassword, setRememberPassword] = useState(false);
  const [isStorageAvailable, setIsStorageAvailable] = useState(false);
  const [hasSavedPassword, setHasSavedPassword] = useState(false);

  // Check if password storage is available and if there's a saved password
  useEffect(() => {
    if (open && dbPath) {
      Promise.all([
        window.sqlPro.password.isAvailable(),
        window.sqlPro.password.has({ dbPath }),
      ]).then(([availableResult, hasResult]) => {
        setIsStorageAvailable(availableResult.available);
        setHasSavedPassword(hasResult.hasPassword);
        // Default to remember if storage is available
        setRememberPassword(availableResult.available);
      });
    }
  }, [open, dbPath]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      onSubmit(password, rememberPassword && isStorageAvailable);
      setPassword('');
      setRememberPassword(false);
    }
  };

  const handleForgetPassword = async () => {
    if (dbPath) {
      await window.sqlPro.password.remove({ dbPath });
      setHasSavedPassword(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <Dialog.Title className="text-lg font-semibold">
              Encrypted Database
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-muted-foreground">
              Enter the password to open{' '}
              <span className="font-medium">{filename}</span>
            </Dialog.Description>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoFocus
              className={cn(
                'w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                'placeholder:text-muted-foreground',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
              )}
            />

            {/* Remember password checkbox */}
            <div className="flex items-center justify-between">
              <label
                className={cn(
                  'flex cursor-pointer items-center gap-2 text-sm',
                  !isStorageAvailable && 'cursor-not-allowed opacity-50'
                )}
              >
                <input
                  type="checkbox"
                  checked={rememberPassword}
                  onChange={(e) => setRememberPassword(e.target.checked)}
                  disabled={!isStorageAvailable}
                  className="h-4 w-4 rounded border-input"
                />
                <span>Remember password</span>
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
              </label>

              {/* Forget saved password link */}
              {hasSavedPassword && (
                <button
                  type="button"
                  onClick={handleForgetPassword}
                  className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  Forget saved password
                </button>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={!password.trim()}
              >
                Open
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
