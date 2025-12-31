import {
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Github,
  Globe,
  Loader2,
  Package,
  Shield,
  Trash2,
  User,
} from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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

// ============ Helper Functions ============

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
 * Get plugin homepage from either PluginInfo or PluginListing
 */
function getPluginHomepage(
  plugin: PluginInfo | PluginListing
): string | undefined {
  return isPluginInfo(plugin) ? plugin.manifest.homepage : plugin.homepage;
}

/**
 * Get plugin repository from either PluginInfo or PluginListing
 */
function getPluginRepository(
  plugin: PluginInfo | PluginListing
): string | undefined {
  return isPluginInfo(plugin) ? plugin.manifest.repository : plugin.repository;
}

/**
 * Get plugin screenshots from either PluginInfo or PluginListing
 */
function getPluginScreenshots(
  plugin: PluginInfo | PluginListing
): string[] | undefined {
  return isPluginInfo(plugin)
    ? plugin.manifest.screenshots
    : plugin.screenshots;
}

/**
 * Get plugin permissions from either PluginInfo or PluginListing
 */
function getPluginPermissions(
  plugin: PluginInfo | PluginListing
): PluginPermission[] | undefined {
  return isPluginInfo(plugin)
    ? plugin.manifest.permissions
    : plugin.permissions;
}

/**
 * Get plugin license from PluginInfo (not available in PluginListing)
 */
function getPluginLicense(
  plugin: PluginInfo | PluginListing
): string | undefined {
  return isPluginInfo(plugin) ? plugin.manifest.license : undefined;
}

/**
 * Get plugin keywords from PluginInfo or categories from PluginListing
 */
function getPluginKeywords(
  plugin: PluginInfo | PluginListing
): string[] | undefined {
  return isPluginInfo(plugin) ? plugin.manifest.keywords : plugin.categories;
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
 * Get human-readable permission label
 */
function getPermissionLabel(permission: PluginPermission): string {
  const labels: Record<PluginPermission, string> = {
    'query:read': 'Read Queries',
    'query:write': 'Execute Queries',
    'ui:menu': 'Add Menu Items',
    'ui:panel': 'Add Panels',
    'ui:command': 'Add Commands',
    'storage:read': 'Read Storage',
    'storage:write': 'Write Storage',
    'connection:info': 'Connection Info',
  };
  return labels[permission] || permission;
}

/**
 * Get permission description
 */
function getPermissionDescription(permission: PluginPermission): string {
  const descriptions: Record<PluginPermission, string> = {
    'query:read': 'Can read and inspect SQL queries before and after execution',
    'query:write': 'Can modify SQL queries and execute database operations',
    'ui:menu': 'Can add items to the application menu bar',
    'ui:panel': 'Can add custom panels to the sidebar or other locations',
    'ui:command': 'Can register commands in the command palette',
    'storage:read': 'Can read data stored by this plugin',
    'storage:write': 'Can store persistent data for this plugin',
    'connection:info':
      'Can access information about the current database connection',
  };
  return descriptions[permission] || 'Unknown permission';
}

/**
 * Format date string for display
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

// ============ PluginDetailView Component ============

export type PluginDetailVariant = 'installed' | 'marketplace';

export interface PluginDetailViewProps {
  /** Whether the detail view is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Plugin data - either installed plugin info or marketplace listing */
  plugin: PluginInfo | PluginListing | null;
  /** Detail view variant determines available actions */
  variant: PluginDetailVariant;
  /** Whether the plugin is currently being operated on (loading state) */
  isLoading?: boolean;
  /** Whether this plugin is already installed (for marketplace variant) */
  isInstalled?: boolean;
  /** Whether an update is available (for installed variant) */
  hasUpdate?: boolean;
  /** Available update version (for installed variant) */
  updateVersion?: string;
  /** Callback when user enables/disables the plugin (installed variant only) */
  onToggleEnabled?: (pluginId: string, enabled: boolean) => void;
  /** Callback when user clicks install (marketplace variant only) */
  onInstall?: (pluginId: string) => void;
  /** Callback when user clicks uninstall (installed variant only) */
  onUninstall?: (pluginId: string) => void;
  /** Callback when user clicks update (installed variant only) */
  onUpdate?: (pluginId: string) => void;
}

/**
 * PluginDetailView displays detailed information about a plugin in a slide-out sheet.
 * Shows plugin metadata, permissions, screenshots, and action buttons.
 */
export function PluginDetailView({
  open,
  onOpenChange,
  plugin,
  variant,
  isLoading = false,
  isInstalled = false,
  hasUpdate = false,
  updateVersion,
  onToggleEnabled,
  onInstall,
  onUninstall,
  onUpdate,
}: PluginDetailViewProps) {
  // State for screenshot carousel
  const [currentScreenshotIndex, setCurrentScreenshotIndex] = React.useState(0);

  // Track previous plugin ID to reset screenshot index when plugin changes
  const prevPluginIdRef = React.useRef<string | null>(null);
  const currentPluginId = plugin ? getPluginId(plugin) : null;

  if (currentPluginId !== prevPluginIdRef.current) {
    prevPluginIdRef.current = currentPluginId;
    if (currentScreenshotIndex !== 0) {
      setCurrentScreenshotIndex(0);
    }
  }

  // Early return if no plugin
  if (!plugin) {
    return null;
  }

  const pluginId = getPluginId(plugin);
  const pluginName = getPluginName(plugin);
  const pluginVersion = getPluginVersion(plugin);
  const pluginDescription = getPluginDescription(plugin);
  const pluginAuthor = getPluginAuthor(plugin);
  const pluginIcon = getPluginIcon(plugin);
  const pluginHomepage = getPluginHomepage(plugin);
  const pluginRepository = getPluginRepository(plugin);
  const pluginScreenshots = getPluginScreenshots(plugin);
  const pluginPermissions = getPluginPermissions(plugin);
  const pluginLicense = getPluginLicense(plugin);
  const pluginKeywords = getPluginKeywords(plugin);

  const isPluginInfoType = isPluginInfo(plugin);
  const pluginState = isPluginInfoType ? plugin.state : undefined;
  const isEnabled = isPluginInfoType ? plugin.enabled : false;
  const hasError = pluginState === 'error';
  const errorMessage = isPluginInfoType ? plugin.error : undefined;
  const installedAt = isPluginInfoType ? plugin.installedAt : undefined;
  const updatedAt = isPluginInfoType
    ? plugin.updatedAt
    : (plugin as PluginListing).updatedAt;
  const downloads = !isPluginInfoType
    ? (plugin as PluginListing).downloads
    : undefined;
  const rating = !isPluginInfoType
    ? (plugin as PluginListing).rating
    : undefined;

  // Screenshot navigation
  const screenshotCount = pluginScreenshots?.length || 0;
  const hasScreenshots = screenshotCount > 0;

  const handlePrevScreenshot = () => {
    setCurrentScreenshotIndex((prev) =>
      prev === 0 ? screenshotCount - 1 : prev - 1
    );
  };

  const handleNextScreenshot = () => {
    setCurrentScreenshotIndex((prev) =>
      prev === screenshotCount - 1 ? 0 : prev + 1
    );
  };

  // Action handlers
  const handleToggleEnabled = (checked: boolean) => {
    onToggleEnabled?.(pluginId, checked);
  };

  const handleInstall = () => {
    onInstall?.(pluginId);
  };

  const handleUninstall = () => {
    onUninstall?.(pluginId);
  };

  const handleUpdate = () => {
    onUpdate?.(pluginId);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          'flex w-full flex-col sm:max-w-lg',
          isLoading && 'pointer-events-none opacity-60'
        )}
      >
        <SheetHeader className="pb-0">
          {/* Plugin Header */}
          <div className="flex items-start gap-4">
            {/* Plugin Icon */}
            <div className="bg-muted flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl">
              {pluginIcon ? (
                <img
                  src={pluginIcon}
                  alt={`${pluginName} icon`}
                  className="size-full object-cover"
                />
              ) : (
                <Package className="text-muted-foreground size-8" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle className="text-xl">{pluginName}</SheetTitle>
                {variant === 'installed' && pluginState && (
                  <Badge variant={getStateBadgeVariant(pluginState)}>
                    {getStateLabel(pluginState)}
                  </Badge>
                )}
                {variant === 'marketplace' && isInstalled && (
                  <Badge variant="secondary">Installed</Badge>
                )}
                {hasUpdate && (
                  <Badge variant="default">
                    Update {updateVersion ? `v${updateVersion}` : 'Available'}
                  </Badge>
                )}
              </div>
              <SheetDescription className="mt-1">
                v{pluginVersion} by {pluginAuthor}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="-mx-4 flex-1 px-4">
          <div className="space-y-6 py-4">
            {/* Error Message */}
            {hasError && errorMessage && (
              <div className="bg-destructive/10 border-destructive/50 flex items-start gap-3 rounded-lg border p-3">
                <AlertCircle className="text-destructive mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-destructive text-sm font-medium">Error</p>
                  <p className="text-destructive/80 text-xs">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <h4 className="mb-2 text-sm font-medium">Description</h4>
              <p className="text-muted-foreground text-sm">
                {pluginDescription}
              </p>
            </div>

            {/* Screenshots */}
            {hasScreenshots && (
              <div>
                <h4 className="mb-2 text-sm font-medium">Screenshots</h4>
                <div className="bg-muted relative overflow-hidden rounded-lg">
                  <img
                    src={pluginScreenshots![currentScreenshotIndex]}
                    alt={`${pluginName} screenshot ${currentScreenshotIndex + 1}`}
                    className="h-48 w-full object-contain"
                  />
                  {screenshotCount > 1 && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="bg-background/80 hover:bg-background/90 absolute top-1/2 left-2 -translate-y-1/2"
                        onClick={handlePrevScreenshot}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        <span className="sr-only">Previous screenshot</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="bg-background/80 hover:bg-background/90 absolute top-1/2 right-2 -translate-y-1/2"
                        onClick={handleNextScreenshot}
                      >
                        <ChevronRight className="h-4 w-4" />
                        <span className="sr-only">Next screenshot</span>
                      </Button>
                      <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
                        {pluginScreenshots!.map((screenshot, index) => (
                          <button
                            key={screenshot}
                            className={cn(
                              'size-2 rounded-full transition-colors',
                              index === currentScreenshotIndex
                                ? 'bg-primary'
                                : 'bg-background/60 hover:bg-background/80'
                            )}
                            onClick={() => setCurrentScreenshotIndex(index)}
                          >
                            <span className="sr-only">
                              Screenshot {index + 1}
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Permissions */}
            {pluginPermissions && pluginPermissions.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Shield className="text-muted-foreground h-4 w-4" />
                  <h4 className="text-sm font-medium">Permissions</h4>
                </div>
                <div className="space-y-2">
                  {pluginPermissions.map((permission) => (
                    <div
                      key={permission}
                      className="bg-muted/50 flex items-start gap-3 rounded-md p-2"
                    >
                      <Badge variant="outline" className="shrink-0">
                        {getPermissionLabel(permission)}
                      </Badge>
                      <p className="text-muted-foreground text-xs">
                        {getPermissionDescription(permission)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Metadata */}
            <div className="space-y-3">
              {/* Author */}
              <div className="flex items-center gap-3 text-sm">
                <User className="text-muted-foreground h-4 w-4 shrink-0" />
                <span className="text-muted-foreground">Author</span>
                <span className="ml-auto font-medium">{pluginAuthor}</span>
              </div>

              {/* License */}
              {pluginLicense && (
                <div className="flex items-center gap-3 text-sm">
                  <Shield className="text-muted-foreground h-4 w-4 shrink-0" />
                  <span className="text-muted-foreground">License</span>
                  <span className="ml-auto font-medium">{pluginLicense}</span>
                </div>
              )}

              {/* Installed Date */}
              {installedAt && (
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="text-muted-foreground h-4 w-4 shrink-0" />
                  <span className="text-muted-foreground">Installed</span>
                  <span className="ml-auto font-medium">
                    {formatDate(installedAt)}
                  </span>
                </div>
              )}

              {/* Last Updated */}
              {updatedAt && (
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="text-muted-foreground h-4 w-4 shrink-0" />
                  <span className="text-muted-foreground">Last Updated</span>
                  <span className="ml-auto font-medium">
                    {formatDate(updatedAt)}
                  </span>
                </div>
              )}

              {/* Downloads (marketplace only) */}
              {downloads !== undefined && (
                <div className="flex items-center gap-3 text-sm">
                  <Download className="text-muted-foreground h-4 w-4 shrink-0" />
                  <span className="text-muted-foreground">Downloads</span>
                  <span className="ml-auto font-medium">
                    {downloads.toLocaleString()}
                  </span>
                </div>
              )}

              {/* Rating (marketplace only) */}
              {rating !== undefined && (
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">Rating</span>
                  <span className="ml-auto font-medium">
                    {rating.toFixed(1)} stars
                  </span>
                </div>
              )}
            </div>

            {/* Keywords / Categories */}
            {pluginKeywords && pluginKeywords.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="mb-2 text-sm font-medium">
                    {isPluginInfoType ? 'Keywords' : 'Categories'}
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {pluginKeywords.map((keyword) => (
                      <Badge
                        key={keyword}
                        variant="secondary"
                        className="text-xs"
                      >
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Links */}
            {(pluginHomepage || pluginRepository) && (
              <>
                <Separator />
                <div className="flex items-center gap-3">
                  {pluginHomepage && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => window.open(pluginHomepage, '_blank')}
                    >
                      <Globe className="mr-2 h-4 w-4" />
                      Website
                      <ExternalLink className="ml-auto h-3 w-3 opacity-50" />
                    </Button>
                  )}
                  {pluginRepository && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => window.open(pluginRepository, '_blank')}
                    >
                      <Github className="mr-2 h-4 w-4" />
                      Repository
                      <ExternalLink className="ml-auto h-3 w-3 opacity-50" />
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        <SheetFooter className="border-t pt-4">
          {/* Installed Plugin Actions */}
          {variant === 'installed' && (
            <div className="flex w-full items-center justify-between gap-3">
              {/* Enable/Disable Toggle */}
              {onToggleEnabled && (
                <div className="flex items-center gap-3">
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={handleToggleEnabled}
                    disabled={isLoading || hasError}
                    aria-label={isEnabled ? 'Disable plugin' : 'Enable plugin'}
                  />
                  <span className="text-muted-foreground text-sm">
                    {isEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              )}

              <div className="ml-auto flex items-center gap-2">
                {/* Update Button */}
                {hasUpdate && onUpdate && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleUpdate}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Update
                  </Button>
                )}

                {/* Uninstall Button */}
                {onUninstall && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleUninstall}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    Uninstall
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Marketplace Plugin Actions */}
          {variant === 'marketplace' && (
            <div className="flex w-full items-center justify-end gap-3">
              {isInstalled ? (
                <Badge variant="secondary" className="px-4 py-1.5 text-sm">
                  Already Installed
                </Badge>
              ) : (
                <Button
                  variant="default"
                  onClick={handleInstall}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Installing...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Install Plugin
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default PluginDetailView;
