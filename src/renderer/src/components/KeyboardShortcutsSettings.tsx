import type {
  PresetName,
  ShortcutAction,
  ShortcutBinding,
  ShortcutsExport,
} from '@/stores/keyboard-shortcuts-store';
import {
  AlertTriangle,
  Check,
  Download,
  Keyboard,
  RotateCcw,
  Upload,
  X,
} from 'lucide-react';
import { memo, useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  formatShortcutBinding,
  parseKeyboardEvent,
  PRESET_INFO,
  SHORTCUT_ACTIONS,
  useKeyboardShortcutsStore,
} from '@/stores/keyboard-shortcuts-store';

interface ShortcutEditorProps {
  label: string;
  description: string;
  binding: ShortcutBinding | null;
  onBindingChange: (binding: ShortcutBinding | null) => void;
  conflicts: ShortcutAction[];
}

const ShortcutEditor = memo(
  ({
    label,
    description,
    binding,
    onBindingChange,
    conflicts,
  }: ShortcutEditorProps) => {
    const [isRecording, setIsRecording] = useState(false);
    const [pendingBinding, setPendingBinding] =
      useState<ShortcutBinding | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (!isRecording) return;

        e.preventDefault();
        e.stopPropagation();

        const parsed = parseKeyboardEvent(e.nativeEvent);
        if (parsed) {
          setPendingBinding(parsed);
        }
      },
      [isRecording]
    );

    const startRecording = () => {
      setIsRecording(true);
      setPendingBinding(null);
      // Focus the input to capture key events
      setTimeout(() => inputRef.current?.focus(), 0);
    };

    const cancelRecording = () => {
      setIsRecording(false);
      setPendingBinding(null);
    };

    const confirmBinding = () => {
      if (pendingBinding) {
        onBindingChange(pendingBinding);
      }
      setIsRecording(false);
      setPendingBinding(null);
    };

    const clearBinding = () => {
      onBindingChange(null);
    };

    const hasConflicts = conflicts.length > 0;

    return (
      <div
        className={cn(
          'flex items-center justify-between gap-4 rounded-lg border p-3 transition-colors',
          isRecording && 'border-primary bg-primary/5',
          hasConflicts && !isRecording && 'border-amber-500/50 bg-amber-500/5'
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{label}</span>
            {hasConflicts && !isRecording && (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            )}
          </div>
          <p className="text-muted-foreground truncate text-xs">
            {description}
          </p>
          {hasConflicts && !isRecording && (
            <p className="mt-1 text-xs text-amber-600">
              Conflicts with:{' '}
              {conflicts
                .map(
                  (c) => SHORTCUT_ACTIONS.find((a) => a.id === c)?.label ?? c
                )
                .join(', ')}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isRecording ? (
            <>
              <Input
                ref={inputRef}
                value={
                  pendingBinding
                    ? formatShortcutBinding(pendingBinding)
                    : 'Press keys...'
                }
                readOnly
                onKeyDown={handleKeyDown}
                onBlur={() => {
                  // Small delay to allow button clicks
                  setTimeout(() => {
                    if (isRecording && !pendingBinding) {
                      cancelRecording();
                    }
                  }, 100);
                }}
                className="h-8 w-32 text-center text-xs"
                placeholder="Press keys..."
              />
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={confirmBinding}
                disabled={!pendingBinding}
                className="text-green-600 hover:text-green-700"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={cancelRecording}
                className="text-red-600 hover:text-red-700"
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <button
                onClick={startRecording}
                className={cn(
                  'flex h-8 min-w-24 items-center justify-center rounded border px-3 text-xs transition-colors',
                  'hover:border-primary hover:bg-muted',
                  !binding && 'text-muted-foreground italic'
                )}
              >
                {formatShortcutBinding(binding)}
              </button>
              {binding && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={clearBinding}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    );
  }
);

ShortcutEditor.displayName = 'ShortcutEditor';

interface KeyboardShortcutsSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const KeyboardShortcutsSettings = memo(
  ({ open, onOpenChange }: KeyboardShortcutsSettingsProps) => {
    const {
      activePreset,
      setPreset,
      setShortcut,
      resetToPreset,
      getActiveShortcuts,
      findConflicts,
      exportShortcuts,
      importShortcuts,
    } = useKeyboardShortcutsStore();

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Get current shortcuts
    const shortcuts = getActiveShortcuts();

    // Group actions by category
    const groupedActions = SHORTCUT_ACTIONS.reduce(
      (acc, action) => {
        if (!acc[action.category]) {
          acc[action.category] = [];
        }
        acc[action.category].push(action);
        return acc;
      },
      {} as Record<string, typeof SHORTCUT_ACTIONS>
    );

    const categoryLabels: Record<string, string> = {
      actions: 'Actions',
      navigation: 'Navigation',
      view: 'View',
      settings: 'Settings',
      help: 'Help',
    };

    const categoryOrder = ['actions', 'navigation', 'view', 'settings', 'help'];

    const handlePresetChange = (preset: PresetName) => {
      if (preset === 'custom') {
        // When switching to custom, keep current shortcuts
        setPreset('custom');
      } else {
        // Reset to the selected preset
        resetToPreset(preset);
      }
    };

    const handleExport = () => {
      const data = exportShortcuts();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sql-pro-shortcuts-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Shortcuts exported successfully');
    };

    const handleImport = () => {
      fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text) as ShortcutsExport;

        if (importShortcuts(data)) {
          toast.success('Shortcuts imported successfully');
        } else {
          toast.error('Failed to import shortcuts: Invalid format');
        }
      } catch {
        toast.error('Failed to import shortcuts: Invalid JSON');
      }

      // Reset file input
      e.target.value = '';
    };

    const handleResetAll = () => {
      resetToPreset('default');
      toast.success('Shortcuts reset to defaults');
    };

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" />
              Keyboard Shortcuts
            </DialogTitle>
            <DialogDescription>
              Customize keyboard shortcuts for all application actions
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6">
            {/* Preset Selection */}
            <div className="mb-6 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Preset</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleImport}
                    className="h-7 gap-1.5 text-xs"
                  >
                    <Upload className="h-3 w-3" />
                    Import
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    className="h-7 gap-1.5 text-xs"
                  >
                    <Download className="h-3 w-3" />
                    Export
                  </Button>
                </div>
              </div>

              <Select
                value={activePreset}
                onValueChange={(v) => v && handlePresetChange(v as PresetName)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRESET_INFO).map(([key, info]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex flex-col">
                        <span>{info.label}</span>
                        <span className="text-muted-foreground text-xs">
                          {info.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {activePreset === 'custom' && (
                <p className="text-muted-foreground text-xs">
                  Click on any shortcut to change it. Press Escape to clear.
                </p>
              )}
            </div>

            {/* Shortcuts by Category */}
            <div className="space-y-6 pb-6">
              {categoryOrder.map((category) => {
                const actions = groupedActions[category];
                if (!actions?.length) return null;

                return (
                  <div key={category} className="space-y-3">
                    <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                      {categoryLabels[category]}
                    </h3>
                    <div className="space-y-2">
                      {actions.map((action) => {
                        const binding = shortcuts[action.id];
                        const conflicts = binding
                          ? findConflicts(action.id, binding)
                          : [];

                        return (
                          <ShortcutEditor
                            key={action.id}
                            label={action.label}
                            description={action.description}
                            binding={binding}
                            onBindingChange={(newBinding) =>
                              setShortcut(action.id, newBinding)
                            }
                            conflicts={conflicts}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button
              variant="outline"
              onClick={handleResetAll}
              className="gap-1.5"
            >
              <RotateCcw className="h-4 w-4" />
              Reset All
            </Button>
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </DialogFooter>

          {/* Hidden file input for import */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />
        </DialogContent>
      </Dialog>
    );
  }
);

KeyboardShortcutsSettings.displayName = 'KeyboardShortcutsSettings';
