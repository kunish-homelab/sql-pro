import type { ALL_PRO_FEATURES } from '@/stores';
import { Button } from '@sqlpro/ui/button';
import { Input } from '@sqlpro/ui/input';
import { Label } from '@sqlpro/ui/label';
import {
  Check,
  Crown,
  Eye,
  EyeOff,
  Key,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useProStore } from '@/stores';
import { ProBadge } from './ProBadge';

/**
 * Human-readable names for Pro features to display in the features list.
 */
const PRO_FEATURE_INFO: {
  id: string;
  name: string;
  description: string;
}[] = [
  {
    id: 'ai-nl-to-sql',
    name: 'Natural Language to SQL',
    description: 'Convert questions into SQL queries using AI',
  },
  {
    id: 'ai-data-analysis',
    name: 'AI Data Analysis',
    description: 'Get AI-powered insights from your data',
  },
  {
    id: 'advanced-export',
    name: 'Advanced Export',
    description: 'Export to Excel, JSON with advanced options',
  },
  {
    id: 'plugin-system',
    name: 'Plugin System',
    description: 'Extend functionality with plugins',
  },
  {
    id: 'query-optimizer',
    name: 'Query Optimizer',
    description: 'Analyze and optimize SQL performance',
  },
];

interface ProActivationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Dialog component for Pro license activation and status management.
 * Allows users to enter their license key to activate Pro features,
 * view current Pro status, and deactivate if needed.
 */
export function ProActivationDialog({
  open,
  onOpenChange,
}: ProActivationDialogProps) {
  const {
    isPro,
    licenseKey,
    activatedAt,
    features,
    isLoading,
    isActivating,
    loadStatus,
    activate,
    deactivate,
  } = useProStore();

  const [showLicenseKey, setShowLicenseKey] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create a key that changes when store values change to reset local state
  const storeKey = useMemo(
    () => `${licenseKey}-${isPro}-${activatedAt}`,
    [licenseKey, isPro, activatedAt]
  );

  const [localLicenseKey, setLocalLicenseKey] = useState(licenseKey ?? '');

  // Load status when dialog opens
  useEffect(() => {
    if (open) {
      loadStatus();
    }
  }, [open, loadStatus]);

  // Reset local state when store values change
  useEffect(() => {
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setLocalLicenseKey(licenseKey ?? '');
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeKey]);

  const handleActivate = async () => {
    setError(null);

    if (!localLicenseKey.trim()) {
      setError('Please enter a license key');
      return;
    }

    if (localLicenseKey.trim().length < 8) {
      setError('License key must be at least 8 characters');
      return;
    }

    const success = await activate(localLicenseKey.trim());
    if (success) {
      onOpenChange(false);
    } else {
      setError('Failed to activate. Please check your license key.');
    }
  };

  const handleDeactivate = async () => {
    setError(null);
    const success = await deactivate();
    if (!success) {
      setError('Failed to deactivate. Please try again.');
    }
  };

  const handleCancel = () => {
    // Reset to store values
    setLocalLicenseKey(licenseKey ?? '');
    setError(null);
    onOpenChange(false);
  };

  // Format activation date
  const formattedActivatedAt = activatedAt
    ? new Date(activatedAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            SQL Pro
            <ProBadge size="sm" />
          </DialogTitle>
          <DialogDescription>
            {isPro
              ? 'Manage your Pro license and see your active features.'
              : 'Enter your license key to unlock Pro features.'}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-4 py-4">
            {/* Pro Status Section (shown when Pro is active) */}
            {isPro && (
              <div className="rounded-lg border border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-yellow-500/10 p-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20">
                    <Crown className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="font-medium">Pro Active</p>
                    {formattedActivatedAt && (
                      <p className="text-muted-foreground text-xs">
                        Activated on {formattedActivatedAt}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* License Key Input */}
            <div className="grid gap-2">
              <Label htmlFor="licenseKey">
                {isPro ? 'License Key' : 'Enter License Key'}
              </Label>
              <div className="relative">
                <Key className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  id="licenseKey"
                  type={showLicenseKey ? 'text' : 'password'}
                  value={localLicenseKey}
                  onChange={(e) => setLocalLicenseKey(e.target.value)}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  className={cn('pr-10 pl-9', error && 'border-destructive')}
                  disabled={isPro}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-0 right-0 h-full px-3"
                  onClick={() => setShowLicenseKey(!showLicenseKey)}
                >
                  {showLicenseKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {error && <p className="text-destructive text-xs">{error}</p>}
              {!isPro && (
                <p className="text-muted-foreground text-xs">
                  Your license key is stored securely on your device.
                </p>
              )}
            </div>

            {/* Pro Features List */}
            <div className="grid gap-2">
              <Label>{isPro ? 'Active Features' : 'Included Features'}</Label>
              <div className="bg-muted/50 space-y-1 rounded-lg border p-3">
                {PRO_FEATURE_INFO.map((featureInfo) => {
                  const isActive =
                    isPro &&
                    features.includes(
                      featureInfo.id as (typeof ALL_PRO_FEATURES)[number]
                    );
                  return (
                    <div
                      key={featureInfo.id}
                      className="flex items-center gap-2 py-1"
                    >
                      <div
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                          isActive
                            ? 'bg-green-500/20 text-green-600'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {isActive ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Sparkles className="h-3 w-3" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'truncate text-sm font-medium',
                            !isActive && !isPro && 'text-muted-foreground'
                          )}
                        >
                          {featureInfo.name}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {isPro ? (
            <>
              <Button
                variant="outline"
                onClick={handleDeactivate}
                disabled={isActivating}
                className="text-destructive hover:bg-destructive/10"
              >
                {isActivating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deactivating...
                  </>
                ) : (
                  'Deactivate License'
                )}
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                Close
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isActivating}
              >
                Cancel
              </Button>
              <Button
                onClick={handleActivate}
                disabled={isActivating || !localLicenseKey.trim()}
                className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white hover:from-amber-600 hover:to-yellow-600"
              >
                {isActivating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Activating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Activate Pro
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
