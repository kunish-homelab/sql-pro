import type { AIProvider } from '../../../shared/types';
import type { FontConfig } from '@/stores/settings-store';
import {
  Check,
  ChevronsUpDown,
  Crown,
  Eye,
  EyeOff,
  FolderSearch,
  Link,
  Loader2,
  Monitor,
  Moon,
  Sparkles,
  Sun,
  Unlink,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  DEFAULT_MODELS,
  useAIStore,
  useProStore,
  useSettingsStore,
  useThemeStore,
} from '@/stores';
import { ProActivationDialog } from './pro/ProActivation';
import { ProBadge } from './pro/ProBadge';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FontOption {
  name: string;
  value: string;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { theme, setTheme } = useThemeStore();
  const {
    editorVimMode,
    setEditorVimMode,
    appVimMode,
    setAppVimMode,
    fonts,
    setFont,
    setSyncAll,
    tabSize,
    setTabSize,
  } = useSettingsStore();
  const { isPro, activatedAt, features } = useProStore();

  // Pro activation dialog state
  const [proDialogOpen, setProDialogOpen] = useState(false);

  // System fonts state
  const [systemFonts, setSystemFonts] = useState<string[]>([]);
  const [fontsLoading, setFontsLoading] = useState(true);

  // Fetch system fonts using Electron IPC
  useEffect(() => {
    let cancelled = false;

    async function loadSystemFonts() {
      // Common monospace fallback fonts
      const fallbackFonts = [
        'Cascadia Code',
        'Consolas',
        'Courier New',
        'Fira Code',
        'Hack',
        'IBM Plex Mono',
        'Inconsolata',
        'JetBrains Mono',
        'Menlo',
        'Monaco',
        'Roboto Mono',
        'SF Mono',
        'Source Code Pro',
        'Ubuntu Mono',
      ];

      try {
        // Use Electron IPC to get system fonts from main process
        const result = await window.sqlPro.system.getFonts();

        if (cancelled) return;

        if (result.success && result.fonts.length > 0) {
          setSystemFonts(result.fonts);
        } else {
          // Fallback to common fonts if no fonts returned
          console.warn('No system fonts returned, using fallback font list');
          setSystemFonts(fallbackFonts);
        }
      } catch (error) {
        console.error('Failed to load system fonts:', error);
        // Fallback to common fonts on error
        if (!cancelled) {
          setSystemFonts(fallbackFonts);
        }
      } finally {
        if (!cancelled) {
          setFontsLoading(false);
        }
      }
    }

    loadSystemFonts();

    return () => {
      cancelled = true;
    };
  }, []);

  // Convert system fonts to FontOption format
  const availableFonts = useMemo((): FontOption[] => {
    const result: FontOption[] = [{ name: 'System Default', value: '' }];

    for (const fontName of systemFonts) {
      result.push({ name: fontName, value: fontName });
    }

    return result;
  }, [systemFonts]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Theme Section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Theme</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={theme === 'light' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('light')}
                className="justify-start"
              >
                <Sun className="mr-2 h-4 w-4" />
                Light
              </Button>
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('dark')}
                className="justify-start"
              >
                <Moon className="mr-2 h-4 w-4" />
                Dark
              </Button>
              <Button
                variant={theme === 'system' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('system')}
                className="justify-start"
              >
                <Monitor className="mr-2 h-4 w-4" />
                System
              </Button>
            </div>
          </div>

          {/* Vim Mode Section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Vim Mode</Label>
            <p className="text-muted-foreground text-xs">
              Enable Vim keybindings for different parts of the application
            </p>
            <div className="grid grid-cols-2 gap-2">
              <VimModeToggle
                label="Editor"
                description="Monaco SQL editor"
                enabled={editorVimMode}
                onToggle={setEditorVimMode}
              />
              <VimModeToggle
                label="App"
                description="Sidebar & DataTable"
                enabled={appVimMode}
                onToggle={setAppVimMode}
              />
            </div>
          </div>

          {/* Font Settings Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Font Settings</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSyncAll(!fonts.syncAll)}
                className={cn(
                  'h-7 gap-1.5 text-xs',
                  fonts.syncAll && 'text-primary'
                )}
              >
                {fonts.syncAll ? (
                  <Link className="h-3.5 w-3.5" />
                ) : (
                  <Unlink className="h-3.5 w-3.5" />
                )}
                {fonts.syncAll ? 'Synced' : 'Independent'}
              </Button>
            </div>

            {fonts.syncAll && (
              <p className="text-muted-foreground -mt-2 text-xs">
                Changes apply to all categories
              </p>
            )}

            {/* Font Controls */}
            <div className="space-y-4">
              <FontSettingsSection
                label="Editor"
                description="SQL editor font"
                config={fonts.editor}
                onChange={(config) => setFont('editor', config)}
                availableFonts={availableFonts}
                synced={fonts.syncAll}
                loading={fontsLoading}
              />
              <FontSettingsSection
                label="Table"
                description="Data table cells"
                config={fonts.table}
                onChange={(config) => setFont('table', config)}
                availableFonts={availableFonts}
                synced={fonts.syncAll}
                loading={fontsLoading}
              />
              <FontSettingsSection
                label="UI"
                description="Application interface"
                config={fonts.ui}
                onChange={(config) => setFont('ui', config)}
                availableFonts={availableFonts}
                synced={fonts.syncAll}
                loading={fontsLoading}
              />
            </div>
          </div>

          {/* Tab Size Section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Tab Size</Label>
            <div className="flex gap-2">
              {[2, 4, 8].map((size) => (
                <Button
                  key={size}
                  variant={tabSize === size ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTabSize(size)}
                >
                  {size}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Pro Section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">SQL Pro</Label>
            <div
              className={cn(
                'rounded-lg border p-4 transition-colors',
                isPro
                  ? 'border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-yellow-500/10'
                  : 'border-border'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full',
                      isPro ? 'bg-amber-500/20' : 'bg-muted'
                    )}
                  >
                    <Crown
                      className={cn(
                        'h-5 w-5',
                        isPro ? 'text-amber-500' : 'text-muted-foreground'
                      )}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {isPro ? 'Pro Active' : 'Free Plan'}
                      </span>
                      {isPro && <ProBadge size="sm" />}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {isPro
                        ? `${features.length} features unlocked${
                            activatedAt
                              ? ` • Activated ${new Date(activatedAt).toLocaleDateString()}`
                              : ''
                          }`
                        : 'Unlock AI features and advanced tools'}
                    </p>
                  </div>
                </div>
                <Button
                  variant={isPro ? 'outline' : 'default'}
                  size="sm"
                  onClick={() => setProDialogOpen(true)}
                  className={
                    isPro
                      ? ''
                      : 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white hover:from-amber-600 hover:to-yellow-600'
                  }
                >
                  {isPro ? 'Manage' : 'Upgrade'}
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          {/* AI Settings Section */}
          <AISettingsSection />
        </div>
      </DialogContent>

      {/* Pro Activation Dialog */}
      <ProActivationDialog
        open={proDialogOpen}
        onOpenChange={setProDialogOpen}
      />
    </Dialog>
  );
}

interface VimModeToggleProps {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

function VimModeToggle({
  label,
  description,
  enabled,
  onToggle,
}: VimModeToggleProps) {
  return (
    <button
      onClick={() => onToggle(!enabled)}
      className={cn(
        'flex flex-col items-start rounded-lg border p-3 text-left transition-colors',
        enabled
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/50 hover:bg-muted/50'
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'font-mono text-xs font-bold uppercase',
            enabled ? 'text-green-600' : 'text-muted-foreground'
          )}
        >
          {enabled ? 'VIM' : 'OFF'}
        </span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span className="text-muted-foreground mt-1 text-xs">{description}</span>
    </button>
  );
}

interface FontSettingsSectionProps {
  label: string;
  description: string;
  config: FontConfig;
  onChange: (config: Partial<FontConfig>) => void;
  availableFonts: FontOption[];
  synced: boolean;
  loading?: boolean;
}

function FontSettingsSection({
  label,
  description,
  config,
  onChange,
  availableFonts,
  synced,
  loading = false,
}: FontSettingsSectionProps) {
  const [fontSelectOpen, setFontSelectOpen] = useState(false);

  const selectedFontName =
    availableFonts.find((f: FontOption) => f.value === config.family)?.name ||
    'System Default';

  return (
    <div
      className={cn(
        'rounded-lg border p-3 transition-colors',
        synced && 'border-primary/20 bg-primary/5'
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <div>
          <span className="text-sm font-medium">{label}</span>
          <span className="text-muted-foreground ml-2 text-xs">
            {description}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Font Family Dropdown */}
        <div className="relative flex-1">
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={fontSelectOpen}
            className="h-8 w-full justify-between text-xs font-normal"
            onClick={() => !loading && setFontSelectOpen(!fontSelectOpen)}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                <span className="truncate">Loading fonts...</span>
              </>
            ) : (
              <span
                className="truncate"
                style={{ fontFamily: config.family || 'inherit' }}
              >
                {selectedFontName}
              </span>
            )}
            <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
          </Button>
          {fontSelectOpen && (
            <div className="bg-popover text-popover-foreground absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border p-1 shadow-md">
              {availableFonts.map((font: FontOption) => (
                <button
                  key={font.value || 'default'}
                  onClick={() => {
                    onChange({ family: font.value });
                    setFontSelectOpen(false);
                  }}
                  className={cn(
                    'relative flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-xs outline-none select-none',
                    'hover:bg-accent hover:text-accent-foreground',
                    config.family === font.value && 'bg-accent'
                  )}
                  style={{ fontFamily: font.value || 'inherit' }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-3 w-3',
                      config.family === font.value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {font.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Font Size Controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onChange({ size: Math.max(10, config.size - 1) })}
            disabled={config.size <= 10}
          >
            -
          </Button>
          <span className="text-muted-foreground w-10 text-center text-xs">
            {config.size}px
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onChange({ size: Math.min(24, config.size + 1) })}
            disabled={config.size >= 24}
          >
            +
          </Button>
        </div>
      </div>
    </div>
  );
}

function AISettingsSection() {
  const {
    provider,
    apiKey,
    model,
    baseUrl,
    claudeCodePath,
    availableClaudeCodePaths,
    isLoading,
    isLoadingClaudeCodePaths,
    loadSettings,
    loadClaudeCodePaths,
    saveSettings,
  } = useAIStore();

  const [showApiKey, setShowApiKey] = useState(false);
  const [modelPopoverOpen, setModelPopoverOpen] = useState(false);
  const [claudeCodePathPopoverOpen, setClaudeCodePathPopoverOpen] =
    useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
    loadClaudeCodePaths();
  }, [loadSettings, loadClaudeCodePaths]);

  const handleProviderChange = (newProvider: AIProvider) => {
    const newModel = DEFAULT_MODELS[newProvider][0];
    saveSettings({
      provider: newProvider,
      model: newModel,
      baseUrl: '',
    });
  };

  const handleApiKeyChange = (newApiKey: string) => {
    saveSettings({ apiKey: newApiKey });
  };

  const handleModelChange = (newModel: string) => {
    saveSettings({ model: newModel });
  };

  const handleBaseUrlChange = (newBaseUrl: string) => {
    saveSettings({ baseUrl: newBaseUrl });
  };

  const handleClaudeCodePathChange = (newPath: string) => {
    saveSettings({ claudeCodePath: newPath });
  };

  const availableModels = DEFAULT_MODELS[provider];

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          <Label className="text-sm font-medium">AI Settings</Label>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4" />
        <Label className="text-sm font-medium">AI Settings</Label>
      </div>

      {/* Provider Selection */}
      <div className="space-y-2">
        <Label htmlFor="provider-select" className="text-xs font-medium">
          AI Provider
        </Label>
        <Select value={provider} onValueChange={handleProviderChange}>
          <SelectTrigger id="provider-select" className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
            <SelectItem value="openai">OpenAI</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* API Key Input */}
      <div className="space-y-2">
        <Label htmlFor="api-key-input" className="text-xs font-medium">
          API Key
        </Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id="api-key-input"
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              placeholder="Enter your API key"
              className="h-8 pr-10 text-xs"
            />
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
            >
              {showApiKey ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Model Selection */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Model</Label>
        <Popover open={modelPopoverOpen} onOpenChange={setModelPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={modelPopoverOpen}
              className="h-8 w-full justify-between text-xs font-normal"
            >
              {model || 'Select model...'}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            <Command>
              <CommandInput
                placeholder="Search models..."
                className="h-8 text-xs"
              />
              <CommandEmpty>No model found.</CommandEmpty>
              <CommandGroup>
                <CommandList>
                  {availableModels.map((m) => (
                    <CommandItem
                      key={m}
                      value={m}
                      onSelect={handleModelChange}
                      className="text-xs"
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          model === m ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      {m}
                    </CommandItem>
                  ))}
                </CommandList>
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Base URL (for custom provider) */}
      {provider === 'custom' && (
        <div className="space-y-2">
          <Label htmlFor="base-url-input" className="text-xs font-medium">
            Base URL
          </Label>
          <Input
            id="base-url-input"
            type="text"
            value={baseUrl}
            onChange={(e) => handleBaseUrlChange(e.target.value)}
            placeholder="https://api.custom.com"
            className="h-8 text-xs"
          />
        </div>
      )}

      {/* Claude Code Path */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Claude Code Path</Label>
        <Popover
          open={claudeCodePathPopoverOpen}
          onOpenChange={setClaudeCodePathPopoverOpen}
        >
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={claudeCodePathPopoverOpen}
              className="h-8 w-full justify-between text-xs font-normal"
              disabled={isLoadingClaudeCodePaths}
            >
              {claudeCodePath ? (
                <span className="truncate">{claudeCodePath}</span>
              ) : (
                'Select path...'
              )}
              {isLoadingClaudeCodePaths ? (
                <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            <Command>
              <CommandInput
                placeholder="Search paths..."
                className="h-8 text-xs"
              />
              <CommandEmpty>No path found.</CommandEmpty>
              <CommandGroup>
                <CommandList>
                  {availableClaudeCodePaths.map((path) => (
                    <CommandItem
                      key={path}
                      value={path}
                      onSelect={handleClaudeCodePathChange}
                      className="text-xs"
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          claudeCodePath === path ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <FolderSearch className="mr-2 h-4 w-4" />
                      <span className="truncate">{path}</span>
                    </CommandItem>
                  ))}
                </CommandList>
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
