import type { PluginInfo, PluginListing } from './PluginCard';
import { Button } from '@sqlpro/ui/button';

import { Input } from '@sqlpro/ui/input';
import { ScrollArea } from '@sqlpro/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@sqlpro/ui/tabs';
import {
  AlertCircle,
  Grid3X3,
  LayoutList,
  Loader2,
  RefreshCw,
  Search,
  Store,
  WifiOff,
} from 'lucide-react';
import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { cn } from '@/lib/utils';
import { PluginCard } from './PluginCard';
import { PluginDetailView } from './PluginDetailView';

// ============ Types ============

export interface PluginMarketplaceProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** List of already installed plugins to show "Installed" badge */
  installedPlugins?: PluginInfo[];
  /** Callback when a plugin is installed */
  onPluginInstalled?: (pluginId: string) => void;
}

type ViewMode = 'grid' | 'list';
type Category = 'all' | string;

interface MarketplaceState {
  plugins: PluginListing[];
  categories: string[];
  isLoading: boolean;
  error: string | null;
  isOffline: boolean;
}

// ============ Helper Functions ============

/**
 * Get unique categories from plugin listings
 */
function extractCategories(plugins: PluginListing[]): string[] {
  const categorySet = new Set<string>();
  for (const plugin of plugins) {
    if (plugin.categories) {
      for (const category of plugin.categories) {
        categorySet.add(category);
      }
    }
  }
  return Array.from(categorySet).sort();
}

/**
 * Filter plugins by search query and category
 */
function filterPlugins(
  plugins: PluginListing[],
  searchQuery: string,
  category: Category
): PluginListing[] {
  let filtered = plugins;

  // Filter by category
  if (category !== 'all') {
    filtered = filtered.filter((plugin) =>
      plugin.categories?.includes(category)
    );
  }

  // Filter by search query
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(
      (plugin) =>
        plugin.name.toLowerCase().includes(query) ||
        plugin.description.toLowerCase().includes(query) ||
        plugin.author.toLowerCase().includes(query) ||
        plugin.categories?.some((cat) => cat.toLowerCase().includes(query))
    );
  }

  return filtered;
}

/**
 * Check if a plugin is installed
 */
function isPluginInstalled(
  pluginId: string,
  installedPlugins: PluginInfo[]
): boolean {
  return installedPlugins.some(
    (installed) => installed.manifest.id === pluginId
  );
}

// ============ PluginMarketplace Component ============

/**
 * PluginMarketplace is a dialog for browsing, searching, and installing plugins
 * from the marketplace registry.
 */
export function PluginMarketplace({
  open,
  onOpenChange,
  installedPlugins = [],
  onPluginInstalled,
}: PluginMarketplaceProps) {
  // State for marketplace data
  const [state, setState] = React.useState<MarketplaceState>({
    plugins: [],
    categories: [],
    isLoading: false,
    error: null,
    isOffline: false,
  });

  // UI state
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedCategory, setSelectedCategory] =
    React.useState<Category>('all');
  const [viewMode, setViewMode] = React.useState<ViewMode>('grid');
  const [installingPluginId, setInstallingPluginId] = React.useState<
    string | null
  >(null);

  // Detail view state
  const [selectedPlugin, setSelectedPlugin] =
    React.useState<PluginListing | null>(null);
  const [detailViewOpen, setDetailViewOpen] = React.useState(false);

  /**
   * Fetch marketplace data from the API
   */
  const fetchMarketplace = React.useCallback(async () => {
    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
      isOffline: false,
    }));

    try {
      const response = await window.sqlPro.plugin.fetchMarketplace({});

      if (response.success && response.registry?.plugins) {
        const categories = extractCategories(response.registry.plugins);
        setState({
          plugins: response.registry.plugins,
          categories,
          isLoading: false,
          error: null,
          isOffline: false,
        });
      } else {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: response.error || 'Failed to fetch marketplace data',
          isOffline: false,
        }));
      }
    } catch (error) {
      // Check if this is a network error (offline)
      const isOffline = !navigator.onLine;
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: isOffline
          ? 'You appear to be offline. Please check your internet connection.'
          : error instanceof Error
            ? error.message
            : 'Failed to fetch marketplace data',
        isOffline,
      }));
    }
  }, []);

  // Fetch marketplace data when dialog opens
  React.useEffect(() => {
    if (open) {
      fetchMarketplace();
    }
  }, [open, fetchMarketplace]);

  // Handle dialog open/close with state reset
  const handleOpenChange = React.useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        // Reset state when closing
        setSearchQuery('');
        setSelectedCategory('all');
        setSelectedPlugin(null);
        setDetailViewOpen(false);
      }
      onOpenChange?.(newOpen);
    },
    [onOpenChange]
  );

  /**
   * Handle plugin installation
   */
  const handleInstallPlugin = React.useCallback(
    async (pluginId: string) => {
      const plugin = state.plugins.find((p) => p.id === pluginId);
      if (!plugin) return;

      setInstallingPluginId(pluginId);

      try {
        const response = await window.sqlPro.plugin.install({
          source: plugin.downloadUrl,
          sourceType: 'url',
        });

        if (response.success) {
          onPluginInstalled?.(pluginId);
          // Close detail view if open
          if (selectedPlugin?.id === pluginId) {
            setDetailViewOpen(false);
          }
        } else {
          // Show error in state or toast
          setState((prev) => ({
            ...prev,
            error: response.error || 'Failed to install plugin',
          }));
        }
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error:
            error instanceof Error ? error.message : 'Failed to install plugin',
        }));
      } finally {
        setInstallingPluginId(null);
      }
    },
    [state.plugins, selectedPlugin, onPluginInstalled]
  );

  /**
   * Handle viewing plugin details
   */
  const handleViewDetails = React.useCallback(
    (pluginId: string) => {
      const plugin = state.plugins.find((p) => p.id === pluginId);
      if (plugin) {
        setSelectedPlugin(plugin);
        setDetailViewOpen(true);
      }
    },
    [state.plugins]
  );

  /**
   * Handle search input changes with debounce
   */
  const handleSearchChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
    },
    []
  );

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    // Cmd/Ctrl+F to focus search
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault();
      const searchInput = document.querySelector<HTMLInputElement>(
        '[data-slot="marketplace-search"]'
      );
      searchInput?.focus();
    }
  }, []);

  // Get filtered plugins
  const filteredPlugins = React.useMemo(
    () => filterPlugins(state.plugins, searchQuery, selectedCategory),
    [state.plugins, searchQuery, selectedCategory]
  );

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="flex max-h-[85vh] flex-col sm:max-w-4xl"
          onKeyDown={handleKeyDown}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Plugin Marketplace
            </DialogTitle>
            <DialogDescription>
              Browse and install plugins to extend SQL Pro functionality
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4">
            {/* Search and Controls */}
            <div className="flex items-center gap-3">
              {/* Search Input */}
              <div className="relative flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  data-slot="marketplace-search"
                  placeholder="Search plugins..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="pl-9"
                />
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 rounded-md border p-1">
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="icon-sm"
                  onClick={() => setViewMode('grid')}
                  aria-label="Grid view"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="icon-sm"
                  onClick={() => setViewMode('list')}
                  aria-label="List view"
                >
                  <LayoutList className="h-4 w-4" />
                </Button>
              </div>

              {/* Refresh Button */}
              <Button
                variant="outline"
                size="icon"
                onClick={fetchMarketplace}
                disabled={state.isLoading}
                aria-label="Refresh marketplace"
              >
                <RefreshCw
                  className={cn('h-4 w-4', state.isLoading && 'animate-spin')}
                />
              </Button>
            </div>

            {/* Category Tabs */}
            {state.categories.length > 0 && (
              <Tabs
                value={selectedCategory}
                onValueChange={(value) =>
                  setSelectedCategory(value as Category)
                }
              >
                <TabsList className="w-full justify-start overflow-x-auto">
                  <TabsTrigger value="all">All</TabsTrigger>
                  {state.categories.map((category) => (
                    <TabsTrigger key={category} value={category}>
                      {category}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            )}

            {/* Content Area */}
            <ScrollArea className="flex-1">
              {/* Loading State */}
              {state.isLoading && (
                <div className="flex flex-col items-center justify-center gap-3 py-16">
                  <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
                  <p className="text-muted-foreground text-sm">
                    Loading marketplace...
                  </p>
                </div>
              )}

              {/* Offline State */}
              {!state.isLoading && state.isOffline && (
                <div className="flex flex-col items-center justify-center gap-4 py-16">
                  <WifiOff className="text-muted-foreground h-12 w-12" />
                  <div className="text-center">
                    <p className="text-sm font-medium">You're offline</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      Please check your internet connection and try again.
                    </p>
                  </div>
                  <Button variant="outline" onClick={fetchMarketplace}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry
                  </Button>
                </div>
              )}

              {/* Error State */}
              {!state.isLoading && !state.isOffline && state.error && (
                <div className="flex flex-col items-center justify-center gap-4 py-16">
                  <div className="bg-destructive/10 border-destructive/50 flex max-w-md items-start gap-3 rounded-lg border p-4">
                    <AlertCircle className="text-destructive mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                      <p className="text-destructive text-sm font-medium">
                        Failed to load marketplace
                      </p>
                      <p className="text-destructive/80 mt-1 text-xs">
                        {state.error}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={fetchMarketplace}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Try Again
                  </Button>
                </div>
              )}

              {/* Empty State */}
              {!state.isLoading &&
                !state.error &&
                filteredPlugins.length === 0 && (
                  <div className="flex flex-col items-center justify-center gap-3 py-16">
                    <Store className="text-muted-foreground h-12 w-12" />
                    {searchQuery || selectedCategory !== 'all' ? (
                      <>
                        <p className="text-sm font-medium">No plugins found</p>
                        <p className="text-muted-foreground text-sm">
                          Try adjusting your search or filter criteria
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSearchQuery('');
                            setSelectedCategory('all');
                          }}
                        >
                          Clear filters
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium">
                          No plugins available
                        </p>
                        <p className="text-muted-foreground text-sm">
                          Check back later for new plugins
                        </p>
                      </>
                    )}
                  </div>
                )}

              {/* Plugin Grid/List */}
              {!state.isLoading &&
                !state.error &&
                filteredPlugins.length > 0 && (
                  <div
                    className={cn(
                      viewMode === 'grid'
                        ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'
                        : 'flex flex-col gap-2'
                    )}
                  >
                    {filteredPlugins.map((plugin) => (
                      <PluginCard
                        key={plugin.id}
                        plugin={plugin}
                        variant="marketplace"
                        layout={viewMode}
                        isLoading={installingPluginId === plugin.id}
                        isInstalled={isPluginInstalled(
                          plugin.id,
                          installedPlugins
                        )}
                        onViewDetails={handleViewDetails}
                        onInstall={handleInstallPlugin}
                      />
                    ))}
                  </div>
                )}
            </ScrollArea>

            {/* Status Bar */}
            {!state.isLoading && !state.error && (
              <div className="text-muted-foreground flex items-center justify-between border-t pt-3 text-xs">
                <span>
                  {filteredPlugins.length} of {state.plugins.length} plugins
                  {searchQuery && ` matching "${searchQuery}"`}
                  {selectedCategory !== 'all' && ` in ${selectedCategory}`}
                </span>
                <span>
                  Press{' '}
                  <kbd className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[10px]">
                    Cmd/Ctrl+F
                  </kbd>{' '}
                  to search
                </span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Plugin Detail View */}
      <PluginDetailView
        open={detailViewOpen}
        onOpenChange={setDetailViewOpen}
        plugin={selectedPlugin}
        variant="marketplace"
        isLoading={installingPluginId === selectedPlugin?.id}
        isInstalled={
          selectedPlugin
            ? isPluginInstalled(selectedPlugin.id, installedPlugins)
            : false
        }
        onInstall={handleInstallPlugin}
      />
    </>
  );
}

export default PluginMarketplace;
