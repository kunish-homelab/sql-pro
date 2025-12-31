import { Download, MoreHorizontal, Package, Trash2 } from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

// ============ Plugin Types (mirrored from main process for renderer usage) ============

/**
 * Plugin permission types for future granular permission system.
 */
export type PluginPermission =
  | 'query:read'
  | 'query:write'
  | 'ui:menu'
  | 'ui:panel'
  | 'ui:command'
  | 'storage:read'
  | 'storage:write'
  | 'connection:info';

/**
 * Plugin manifest schema (plugin.json).
 */
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;
  permissions?: PluginPermission[];
  engines?: {
    sqlpro?: string;
  };
  homepage?: string;
  repository?: string;
  license?: string;
  keywords?: string[];
  icon?: string;
  screenshots?: string[];
  apiVersion?: string;
}

/**
 * Possible states for a plugin during its lifecycle.
 */
export type PluginState =
  | 'installed'
  | 'enabled'
  | 'disabled'
  | 'error'
  | 'loading'
  | 'unloading';

/**
 * Stored plugin metadata including state and settings.
 */
export interface PluginInfo {
  manifest: PluginManifest;
  path: string;
  state: PluginState;
  enabled: boolean;
  installedAt: string;
  updatedAt?: string;
  error?: string;
}

/**
 * Plugin listing in the marketplace.
 */
export interface PluginListing {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  downloadUrl: string;
  iconUrl?: string;
  screenshots?: string[];
  homepage?: string;
  repository?: string;
  categories?: string[];
  downloads?: number;
  rating?: number;
  updatedAt: string;
  engineVersion?: string;
  permissions?: PluginPermission[];
}

// ============ PluginCard Component ============

export type PluginCardVariant = 'installed' | 'marketplace';
export type PluginCardLayout = 'grid' | 'list';

export interface PluginCardProps {
  /** Plugin data - either installed plugin info or marketplace listing */
  plugin: PluginInfo | PluginListing;
  /** Card variant determines available actions */
  variant: PluginCardVariant;
  /** Layout mode for the card */
  layout?: PluginCardLayout;
  /** Whether the plugin is currently being operated on (loading state) */
  isLoading?: boolean;
  /** Whether this plugin is already installed (for marketplace variant) */
  isInstalled?: boolean;
  /** Whether an update is available (for installed variant) */
  hasUpdate?: boolean;
  /** Callback when user clicks on the card to view details */
  onViewDetails?: (pluginId: string) => void;
  /** Callback when user enables/disables the plugin (installed variant only) */
  onToggleEnabled?: (pluginId: string, enabled: boolean) => void;
  /** Callback when user clicks install (marketplace variant only) */
  onInstall?: (pluginId: string) => void;
  /** Callback when user clicks uninstall (installed variant only) */
  onUninstall?: (pluginId: string) => void;
  /** Callback when user clicks update (installed variant only) */
  onUpdate?: (pluginId: string) => void;
  /** Additional class names */
  className?: string;
}

/**
 * Type guard to check if plugin data is PluginInfo (installed plugin)
 */
function isPluginInfo(
  plugin: PluginInfo | PluginListing
): plugin is PluginInfo {
  return 'manifest' in plugin && 'state' in plugin;
}

/**
 * Get plugin name from either PluginInfo or PluginListing
 */
function getPluginName(plugin: PluginInfo | PluginListing): string {
  return isPluginInfo(plugin) ? plugin.manifest.name : plugin.name;
}

/**
 * Get plugin id from either PluginInfo or PluginListing
 */
function getPluginId(plugin: PluginInfo | PluginListing): string {
  return isPluginInfo(plugin) ? plugin.manifest.id : plugin.id;
}

/**
 * Get plugin version from either PluginInfo or PluginListing
 */
function getPluginVersion(plugin: PluginInfo | PluginListing): string {
  return isPluginInfo(plugin) ? plugin.manifest.version : plugin.version;
}

/**
 * Get plugin description from either PluginInfo or PluginListing
 */
function getPluginDescription(plugin: PluginInfo | PluginListing): string {
  return isPluginInfo(plugin)
    ? plugin.manifest.description
    : plugin.description;
}

/**
 * Get plugin author from either PluginInfo or PluginListing
 */
function getPluginAuthor(plugin: PluginInfo | PluginListing): string {
  return isPluginInfo(plugin) ? plugin.manifest.author : plugin.author;
}

/**
 * Get plugin icon URL from either PluginInfo or PluginListing
 */
function getPluginIcon(plugin: PluginInfo | PluginListing): string | undefined {
  return isPluginInfo(plugin) ? plugin.manifest.icon : plugin.iconUrl;
}

/**
 * Get state badge variant based on plugin state
 */
function getStateBadgeVariant(
  state: PluginState
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (state) {
    case 'enabled':
      return 'default';
    case 'disabled':
    case 'installed':
      return 'secondary';
    case 'error':
      return 'destructive';
    case 'loading':
    case 'unloading':
      return 'outline';
    default:
      return 'secondary';
  }
}

/**
 * Get human-readable state label
 */
function getStateLabel(state: PluginState): string {
  switch (state) {
    case 'enabled':
      return 'Enabled';
    case 'disabled':
      return 'Disabled';
    case 'installed':
      return 'Installed';
    case 'error':
      return 'Error';
    case 'loading':
      return 'Loading...';
    case 'unloading':
      return 'Unloading...';
    default:
      return state;
  }
}

/**
 * PluginCard displays a plugin in a list or grid view.
 * Supports both installed plugins and marketplace listings with appropriate actions.
 */
export function PluginCard({
  plugin,
  variant,
  layout = 'grid',
  isLoading = false,
  isInstalled = false,
  hasUpdate = false,
  onViewDetails,
  onToggleEnabled,
  onInstall,
  onUninstall,
  onUpdate,
  className,
}: PluginCardProps) {
  const pluginId = getPluginId(plugin);
  const pluginName = getPluginName(plugin);
  const pluginVersion = getPluginVersion(plugin);
  const pluginDescription = getPluginDescription(plugin);
  const pluginAuthor = getPluginAuthor(plugin);
  const pluginIcon = getPluginIcon(plugin);

  const isPluginInfoType = isPluginInfo(plugin);
  const pluginState = isPluginInfoType ? plugin.state : undefined;
  const isEnabled = isPluginInfoType ? plugin.enabled : false;
  const hasError = pluginState === 'error';
  const errorMessage = isPluginInfoType ? plugin.error : undefined;

  // Handle card click for viewing details
  const handleCardClick = React.useCallback(
    (e: React.MouseEvent) => {
      // Don't trigger if clicking on interactive elements
      const target = e.target as HTMLElement;
      if (
        target.closest('button') ||
        target.closest('[role="switch"]') ||
        target.closest('[role="menuitem"]')
      ) {
        return;
      }
      onViewDetails?.(pluginId);
    },
    [onViewDetails, pluginId]
  );

  // Handle enable/disable toggle
  const handleToggleEnabled = React.useCallback(
    (checked: boolean) => {
      onToggleEnabled?.(pluginId, checked);
    },
    [onToggleEnabled, pluginId]
  );

  // Handle install action
  const handleInstall = React.useCallback(() => {
    onInstall?.(pluginId);
  }, [onInstall, pluginId]);

  // Handle uninstall action
  const handleUninstall = React.useCallback(() => {
    onUninstall?.(pluginId);
  }, [onUninstall, pluginId]);

  // Handle update action
  const handleUpdate = React.useCallback(() => {
    onUpdate?.(pluginId);
  }, [onUpdate, pluginId]);

  // List layout renders a more compact horizontal card
  if (layout === 'list') {
    return (
      <Card
        data-slot="plugin-card"
        data-variant={variant}
        data-layout="list"
        className={cn(
          'hover:bg-accent/50 flex cursor-pointer flex-row items-center gap-4 px-4 py-3 transition-colors',
          isLoading && 'pointer-events-none opacity-60',
          hasError && 'border-destructive/50',
          className
        )}
        onClick={handleCardClick}
      >
        {/* Plugin Icon */}
        <div className="bg-muted flex size-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg">
          {pluginIcon ? (
            <img
              src={pluginIcon}
              alt={`${pluginName} icon`}
              className="size-full object-cover"
            />
          ) : (
            <Package className="text-muted-foreground size-5" />
          )}
        </div>

        {/* Plugin Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{pluginName}</span>
            <span className="text-muted-foreground text-xs">
              v{pluginVersion}
            </span>
            {variant === 'installed' && pluginState && (
              <Badge
                variant={getStateBadgeVariant(pluginState)}
                className="px-1.5 text-[10px]"
              >
                {getStateLabel(pluginState)}
              </Badge>
            )}
            {variant === 'marketplace' && isInstalled && (
              <Badge variant="secondary" className="px-1.5 text-[10px]">
                Installed
              </Badge>
            )}
            {hasUpdate && (
              <Badge variant="default" className="px-1.5 text-[10px]">
                Update
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground truncate text-sm">
            {pluginDescription}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {variant === 'installed' && onToggleEnabled && (
            <Switch
              checked={isEnabled}
              onCheckedChange={handleToggleEnabled}
              disabled={isLoading || hasError}
              aria-label={isEnabled ? 'Disable plugin' : 'Enable plugin'}
            />
          )}
          {variant === 'marketplace' && !isInstalled && onInstall && (
            <Button
              variant="default"
              size="sm"
              onClick={handleInstall}
              disabled={isLoading}
            >
              <Download className="size-4" />
              Install
            </Button>
          )}
          {variant === 'installed' && (
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button variant="ghost" size="icon-sm" disabled={isLoading}>
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">Plugin options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {hasUpdate && onUpdate && (
                  <>
                    <DropdownMenuItem onClick={handleUpdate}>
                      <Download className="size-4" />
                      Update Plugin
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {onUninstall && (
                  <DropdownMenuItem
                    onClick={handleUninstall}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="size-4" />
                    Uninstall
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </Card>
    );
  }

  // Grid layout renders a full card with header, content, and footer
  return (
    <Card
      data-slot="plugin-card"
      data-variant={variant}
      data-layout="grid"
      className={cn(
        'hover:bg-accent/30 cursor-pointer transition-colors',
        isLoading && 'pointer-events-none opacity-60',
        hasError && 'border-destructive/50',
        className
      )}
      onClick={handleCardClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          {/* Plugin Icon */}
          <div className="bg-muted flex size-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg">
            {pluginIcon ? (
              <img
                src={pluginIcon}
                alt={`${pluginName} icon`}
                className="size-full object-cover"
              />
            ) : (
              <Package className="text-muted-foreground size-6" />
            )}
          </div>

          {/* Title and Status */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="truncate text-base">{pluginName}</CardTitle>
              {variant === 'installed' && pluginState && (
                <Badge variant={getStateBadgeVariant(pluginState)}>
                  {getStateLabel(pluginState)}
                </Badge>
              )}
              {variant === 'marketplace' && isInstalled && (
                <Badge variant="secondary">Installed</Badge>
              )}
              {hasUpdate && <Badge variant="default">Update</Badge>}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-muted-foreground text-xs">
                v{pluginVersion}
              </span>
              <span className="text-muted-foreground text-xs">
                by {pluginAuthor}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        <CardDescription className="line-clamp-2">
          {pluginDescription}
        </CardDescription>
        {hasError && errorMessage && (
          <p className="text-destructive mt-2 line-clamp-2 text-xs">
            {errorMessage}
          </p>
        )}
      </CardContent>

      <CardFooter className="justify-between pt-0">
        {/* Marketplace downloads/rating info */}
        {variant === 'marketplace' && !isPluginInfoType && (
          <div className="text-muted-foreground flex items-center gap-3 text-xs">
            {'downloads' in plugin && plugin.downloads !== undefined && (
              <span>{plugin.downloads.toLocaleString()} downloads</span>
            )}
            {'rating' in plugin && plugin.rating !== undefined && (
              <span>{plugin.rating.toFixed(1)} stars</span>
            )}
          </div>
        )}

        {/* Installed plugin enable toggle */}
        {variant === 'installed' && (
          <div className="flex-1" /> // Spacer
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {variant === 'installed' && onToggleEnabled && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">
                {isEnabled ? 'Enabled' : 'Disabled'}
              </span>
              <Switch
                checked={isEnabled}
                onCheckedChange={handleToggleEnabled}
                disabled={isLoading || hasError}
                aria-label={isEnabled ? 'Disable plugin' : 'Enable plugin'}
              />
            </div>
          )}
          {variant === 'marketplace' && !isInstalled && onInstall && (
            <Button
              variant="default"
              size="sm"
              onClick={handleInstall}
              disabled={isLoading}
            >
              <Download className="size-4" />
              Install
            </Button>
          )}
          {variant === 'installed' && (
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button variant="ghost" size="icon-sm" disabled={isLoading}>
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">Plugin options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {hasUpdate && onUpdate && (
                  <>
                    <DropdownMenuItem onClick={handleUpdate}>
                      <Download className="size-4" />
                      Update Plugin
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {onUninstall && (
                  <DropdownMenuItem
                    onClick={handleUninstall}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="size-4" />
                    Uninstall
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}

export default PluginCard;
