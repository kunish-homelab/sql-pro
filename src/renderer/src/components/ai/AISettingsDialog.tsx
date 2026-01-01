import type { AIProvider } from '@shared/types';
import {
  Check,
  ChevronsUpDown,
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ProBadge } from '@/components/pro/ProBadge';
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
  DialogDescription,
  DialogFooter,
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
import { cn } from '@/lib/utils';
import { DEFAULT_MODELS, useAIStore } from '@/stores';

interface AISettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AISettingsDialog({
  open,
  onOpenChange,
}: AISettingsDialogProps) {
  const {
    provider,
    apiKey,
    model,
    baseUrl,
    isLoading,
    isSaving,
    loadSettings,
    saveSettings,
  } = useAIStore();

  const [showApiKey, setShowApiKey] = useState(false);
  const [modelPopoverOpen, setModelPopoverOpen] = useState(false);

  // Create a key that changes when store values change to reset local state
  const storeKey = useMemo(
    () => `${apiKey}-${provider}-${model}-${baseUrl}`,
    [apiKey, provider, model, baseUrl]
  );

  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [localProvider, setLocalProvider] = useState<AIProvider>(provider);
  const [localModel, setLocalModel] = useState(model);
  const [localBaseUrl, setLocalBaseUrl] = useState(baseUrl);

  // Load settings when dialog opens
  useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [open, loadSettings]);

  // Reset local state when store values change (using key pattern)
  useEffect(() => {
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setLocalApiKey(apiKey);
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setLocalProvider(provider);
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setLocalModel(model);
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setLocalBaseUrl(baseUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeKey]);

  const handleProviderChange = (newProvider: AIProvider) => {
    setLocalProvider(newProvider);
    // Reset to first model of new provider
    setLocalModel(DEFAULT_MODELS[newProvider][0]);
    // Reset base URL when switching providers
    setLocalBaseUrl('');
  };

  const handleSave = async () => {
    const success = await saveSettings({
      provider: localProvider,
      apiKey: localApiKey,
      model: localModel,
      baseUrl: localBaseUrl,
    });
    if (success) {
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    // Reset to store values
    setLocalApiKey(apiKey);
    setLocalProvider(provider);
    setLocalModel(model);
    setLocalBaseUrl(baseUrl);
    onOpenChange(false);
  };

  const availableModels = DEFAULT_MODELS[localProvider];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-106.25">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Settings
            <ProBadge size="sm" />
          </DialogTitle>
          <DialogDescription>
            Configure your AI provider and API key to enable AI-powered features
            like natural language to SQL conversion, query optimization, and
            data analysis.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-4 py-4">
            {/* Provider Selection */}
            <div className="grid gap-2">
              <Label htmlFor="provider">AI Provider</Label>
              <Select
                value={localProvider}
                onValueChange={(value) =>
                  handleProviderChange(value as AIProvider)
                }
              >
                <SelectTrigger id="provider">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* API Key Input */}
            <div className="grid gap-2">
              <Label htmlFor="apiKey">API Key</Label>
              <div className="relative">
                <Input
                  id="apiKey"
                  type={showApiKey ? 'text' : 'password'}
                  value={localApiKey}
                  onChange={(e) => setLocalApiKey(e.target.value)}
                  placeholder={
                    localProvider === 'openai' ? 'sk-...' : 'sk-ant-...'
                  }
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-0 right-0 h-full px-3"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                Your API key is stored securely and never shared.
              </p>
            </div>

            {/* Base URL Input */}
            <div className="grid gap-2">
              <Label htmlFor="baseUrl">Base URL (Optional)</Label>
              <Input
                id="baseUrl"
                type="text"
                value={localBaseUrl}
                onChange={(e) => setLocalBaseUrl(e.target.value)}
                placeholder={
                  localProvider === 'openai'
                    ? 'https://api.openai.com/v1'
                    : 'https://api.anthropic.com'
                }
              />
              <p className="text-muted-foreground text-xs">
                Custom API base URL. Leave empty to use the official{' '}
                {localProvider === 'openai' ? 'OpenAI' : 'Anthropic'} API.
              </p>
            </div>

            {/* Model Selection with Custom Input */}
            <div className="grid gap-2">
              <Label htmlFor="model">Model</Label>
              <Popover
                open={modelPopoverOpen}
                onOpenChange={setModelPopoverOpen}
              >
                <PopoverTrigger>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={modelPopoverOpen}
                    className="w-full justify-between font-normal"
                  >
                    {localModel || 'Select or enter model...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-(--radix-popover-trigger-width) p-0"
                  align="start"
                >
                  <Command>
                    <CommandInput
                      placeholder="Search or enter custom model..."
                      value={localModel}
                      onValueChange={setLocalModel}
                    />
                    <CommandList>
                      <CommandEmpty>
                        <div className="py-2 text-sm">
                          Press Enter to use "{localModel}"
                        </div>
                      </CommandEmpty>
                      <CommandGroup heading="Suggested Models">
                        {availableModels.map((m) => (
                          <CommandItem
                            key={m}
                            value={m}
                            onSelect={(currentValue) => {
                              setLocalModel(currentValue);
                              setModelPopoverOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                localModel === m ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            {m}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-muted-foreground text-xs">
                Select a suggested model or enter a custom model name.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !localApiKey}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
