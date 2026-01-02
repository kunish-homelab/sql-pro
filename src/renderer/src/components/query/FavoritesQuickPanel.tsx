import type { SavedQuery } from '@shared/types';
import { FileText, Star } from 'lucide-react';
import { useCallback, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useSavedQueriesStore } from '@/stores/saved-queries-store';

interface FavoritesQuickPanelProps {
  /** Callback when a query is loaded into the editor */
  onLoadQuery?: (query: SavedQuery) => void;
  /** Whether to render as a standalone section (true) or popover trigger (false) */
  asSection?: boolean;
}

export function FavoritesQuickPanel({
  onLoadQuery,
  asSection = false,
}: FavoritesQuickPanelProps) {
  // Store state
  const { savedQueries, isLoading, loadSavedQueries } = useSavedQueriesStore();

  // Load saved queries on mount
  useEffect(() => {
    loadSavedQueries();
  }, [loadSavedQueries]);

  // Filter only favorite queries
  const favoriteQueries = useMemo(() => {
    return savedQueries.filter((q) => q.isFavorite);
  }, [savedQueries]);

  const handleLoadQuery = useCallback(
    (query: SavedQuery) => {
      if (onLoadQuery) {
        onLoadQuery(query);
      }
    },
    [onLoadQuery]
  );

  const getQueryPreview = useCallback((queryText: string): string => {
    // Get first line or first 60 characters (shorter for compact view)
    const firstLine = queryText.split('\n')[0];
    return firstLine.length > 60
      ? `${firstLine.substring(0, 60)}...`
      : firstLine;
  }, []);

  // Content that can be rendered in popover or section
  const content = (
    <div className="flex flex-col">
      {isLoading ? (
        // Skeleton loading state
        <div className="space-y-1 p-1">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-md px-3 py-2.5">
              <div className="flex items-start gap-2">
                {/* Icon skeleton */}
                <Skeleton className="h-8 w-8 flex-shrink-0 rounded" />

                {/* Content skeleton */}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-5 w-full rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : favoriteQueries.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <Star className="text-muted-foreground/50 mx-auto h-8 w-8" />
          <h3 className="text-muted-foreground mt-3 text-sm font-medium">
            No favorite queries
          </h3>
          <p className="text-muted-foreground mt-1 text-xs">
            Star queries to add them here
          </p>
        </div>
      ) : (
        <ScrollArea className={asSection ? 'h-full' : 'max-h-96'}>
          <div className="space-y-1 p-1">
            {favoriteQueries.map((query) => {
              const queryPreview = getQueryPreview(query.queryText);

              return (
                <button
                  key={query.id}
                  onClick={() => handleLoadQuery(query)}
                  className="hover:bg-accent focus-visible:bg-accent focus-visible:ring-ring w-full rounded-md px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  title={query.description || query.name}
                  type="button"
                >
                  <div className="flex items-start gap-2">
                    {/* Icon */}
                    <div className="bg-primary/10 text-primary mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded">
                      <FileText className="h-4 w-4" />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Star className="h-3 w-3 flex-shrink-0 fill-yellow-400 text-yellow-400" />
                        <span className="truncate text-sm font-medium">
                          {query.name}
                        </span>
                      </div>
                      <div className="bg-muted/50 text-muted-foreground mt-1.5 truncate rounded px-1.5 py-0.5 font-mono text-xs">
                        {queryPreview}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );

  // Render as standalone section
  if (asSection) {
    return (
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="border-b p-3">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            <h3 className="text-sm font-semibold">Favorites</h3>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            Quick access to your starred queries
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">{content}</div>
      </div>
    );
  }

  // Render as popover dropdown
  return (
    <Popover>
      <PopoverTrigger>
        <Button variant="ghost" size="sm" title="Favorite Queries">
          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
          {favoriteQueries.length > 0 && (
            <span className="ml-1.5 text-xs">({favoriteQueries.length})</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <PopoverHeader>
          <PopoverTitle className="flex items-center gap-2">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            Favorite Queries
          </PopoverTitle>
        </PopoverHeader>
        {content}
      </PopoverContent>
    </Popover>
  );
}
