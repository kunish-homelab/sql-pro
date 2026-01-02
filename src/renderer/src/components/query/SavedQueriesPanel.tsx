import type { SavedQuery } from '@shared/types';
import {
  Bookmark,
  Copy,
  FileText,
  Loader2,
  MoreVertical,
  Pencil,
  Play,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Toggle } from '@/components/ui/toggle';
import { useCollectionsStore } from '@/stores/collections-store';
import { useSavedQueriesStore } from '@/stores/saved-queries-store';

interface SavedQueriesPanelProps {
  /** Callback when a query is loaded into the editor */
  onLoadQuery?: (query: SavedQuery) => void;
}

interface EditFormData {
  name: string;
  description: string;
  isFavorite: boolean;
}

export function SavedQueriesPanel({ onLoadQuery }: SavedQueriesPanelProps) {
  // Store state
  const {
    savedQueries,
    isLoading,
    loadSavedQueries,
    updateSavedQuery,
    deleteSavedQuery,
    toggleFavorite,
    favoritesOnly,
    setFavoritesOnly,
    selectedCollectionId,
  } = useSavedQueriesStore();

  const { collections } = useCollectionsStore();

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedQuery, setSelectedQuery] = useState<SavedQuery | null>(null);

  // Edit form state
  const [editFormData, setEditFormData] = useState<EditFormData>({
    name: '',
    description: '',
    isFavorite: false,
  });
  const [nameError, setNameError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Load saved queries on mount
  useEffect(() => {
    loadSavedQueries();
  }, [loadSavedQueries]);

  // Reset edit form when dialog closes
  useEffect(() => {
    if (!editDialogOpen) {
      setEditFormData({
        name: '',
        description: '',
        isFavorite: false,
      });
      setNameError('');
      setSelectedQuery(null);
    }
  }, [editDialogOpen]);

  // Populate form when editing
  useEffect(() => {
    if (editDialogOpen && selectedQuery) {
      setEditFormData({
        name: selectedQuery.name,
        description: selectedQuery.description || '',
        isFavorite: selectedQuery.isFavorite,
      });
    }
  }, [editDialogOpen, selectedQuery]);

  // Filter and search queries
  const filteredQueries = useMemo(() => {
    let filtered = [...savedQueries];

    // Filter by favorites
    if (favoritesOnly) {
      filtered = filtered.filter((q) => q.isFavorite);
    }

    // Filter by collection
    if (selectedCollectionId) {
      filtered = filtered.filter((q) =>
        q.collectionIds.includes(selectedCollectionId)
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const search = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (q) =>
          q.name.toLowerCase().includes(search) ||
          q.description?.toLowerCase().includes(search) ||
          q.queryText.toLowerCase().includes(search)
      );
    }

    return filtered;
  }, [savedQueries, favoritesOnly, selectedCollectionId, searchQuery]);

  const validateForm = useCallback((): boolean => {
    if (!editFormData.name.trim()) {
      setNameError('Query name is required');
      return false;
    }
    setNameError('');
    return true;
  }, [editFormData.name]);

  const handleEdit = useCallback(async () => {
    if (!validateForm() || !selectedQuery) {
      return;
    }

    setIsSaving(true);

    try {
      await updateSavedQuery(selectedQuery.id, {
        name: editFormData.name.trim(),
        description: editFormData.description.trim() || undefined,
        isFavorite: editFormData.isFavorite,
      });
      setEditDialogOpen(false);
    } catch (error) {
      // Error is already handled by the store
    } finally {
      setIsSaving(false);
    }
  }, [validateForm, updateSavedQuery, selectedQuery, editFormData]);

  const handleDelete = useCallback(async () => {
    if (!selectedQuery) {
      return;
    }

    try {
      await deleteSavedQuery(selectedQuery.id);
      setDeleteDialogOpen(false);
    } catch (error) {
      // Error is already handled by the store
    }
  }, [deleteSavedQuery, selectedQuery]);

  const handleToggleFavorite = useCallback(
    async (query: SavedQuery, event: React.MouseEvent) => {
      event.stopPropagation();
      await toggleFavorite(query.id, !query.isFavorite);
    },
    [toggleFavorite]
  );

  const handleLoadQuery = useCallback(
    (query: SavedQuery) => {
      if (onLoadQuery) {
        onLoadQuery(query);
      }
    },
    [onLoadQuery]
  );

  const handleCopyQuery = useCallback(
    async (query: SavedQuery, event: React.MouseEvent) => {
      event.stopPropagation();
      try {
        await navigator.clipboard.writeText(query.queryText);
      } catch (error) {
        // Silent fail - clipboard API might not be available
      }
    },
    []
  );

  const openEditDialog = useCallback((query: SavedQuery) => {
    setSelectedQuery(query);
    setEditDialogOpen(true);
  }, []);

  const openDeleteDialog = useCallback((query: SavedQuery) => {
    setSelectedQuery(query);
    setDeleteDialogOpen(true);
  }, []);

  const getCollectionNames = useCallback(
    (collectionIds: string[]): string => {
      const names = collectionIds
        .map((id) => {
          const collection = collections.find((c) => c.id === id);
          return collection?.name;
        })
        .filter(Boolean);

      return names.length > 0 ? names.join(', ') : '';
    },
    [collections]
  );

  const getQueryPreview = useCallback((queryText: string): string => {
    // Get first line or first 100 characters
    const firstLine = queryText.split('\n')[0];
    return firstLine.length > 100
      ? firstLine.substring(0, 100) + '...'
      : firstLine;
  }, []);

  const selectedCollectionName = useMemo(() => {
    if (!selectedCollectionId) return null;
    const collection = collections.find((c) => c.id === selectedCollectionId);
    return collection?.name;
  }, [selectedCollectionId, collections]);

  const isSaveDisabled = isSaving || !editFormData.name.trim();

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Saved Queries</h2>
            <p className="text-muted-foreground text-sm">
              {selectedCollectionName
                ? `Filtered by ${selectedCollectionName}`
                : 'Access and manage your saved queries'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Favorites Filter Toggle */}
            <Toggle
              pressed={favoritesOnly}
              onPressedChange={setFavoritesOnly}
              aria-label="Show only favorites"
              size="sm"
            >
              <Star
                className={`h-4 w-4 ${favoritesOnly ? 'fill-yellow-400 text-yellow-400' : ''}`}
              />
            </Toggle>
          </div>
        </div>

        {/* Search */}
        <div className="mt-3 relative">
          <Search className="text-muted-foreground absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            type="search"
            placeholder="Search queries by name, description, or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
              onClick={() => setSearchQuery('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Queries List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {isLoading ? (
            // Skeleton loading state
            <>
              {Array.from({ length: 3 }).map((_, index) => (
                <Card key={index} size="sm">
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      {/* Icon skeleton */}
                      <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />

                      {/* Content skeleton */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-8 w-full rounded" />
                        <div className="flex items-center gap-4">
                          <Skeleton className="h-3 w-24" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                      </div>

                      {/* Action skeleton */}
                      <Skeleton className="h-8 w-8 rounded flex-shrink-0" />
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </>
          ) : filteredQueries.length === 0 ? (
            <div className="text-center py-12">
              <Bookmark className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-sm font-medium">
                {searchQuery
                  ? 'No queries found'
                  : favoritesOnly
                    ? 'No favorite queries'
                    : selectedCollectionId
                      ? 'No queries in this collection'
                      : 'No saved queries yet'}
              </h3>
              <p className="text-muted-foreground mt-2 text-sm">
                {searchQuery
                  ? 'Try a different search term'
                  : favoritesOnly
                    ? 'Star queries to mark them as favorites'
                    : selectedCollectionId
                      ? 'Add queries to this collection to see them here'
                      : 'Save queries from the editor to see them here'}
              </p>
            </div>
          ) : (
            filteredQueries.map((query) => {
              const collectionNames = getCollectionNames(query.collectionIds);
              const queryPreview = getQueryPreview(query.queryText);

              return (
                <Card
                  key={query.id}
                  size="sm"
                  className="cursor-pointer transition-colors hover:bg-accent"
                  onClick={() => handleLoadQuery(query)}
                >
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-lg">
                        <FileText className="h-5 w-5" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <CardTitle className="flex-1">{query.name}</CardTitle>
                          {/* Favorite Star */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 -mt-1"
                            onClick={(e) => handleToggleFavorite(query, e)}
                          >
                            <Star
                              className={`h-4 w-4 ${
                                query.isFavorite
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : ''
                              }`}
                            />
                          </Button>
                        </div>

                        {query.description && (
                          <CardDescription className="mt-1">
                            {query.description}
                          </CardDescription>
                        )}

                        {/* Query Preview */}
                        <div className="bg-muted text-muted-foreground mt-2 rounded px-2 py-1 font-mono text-xs">
                          {queryPreview}
                        </div>

                        {/* Metadata */}
                        <div className="text-muted-foreground mt-2 flex items-center gap-4 text-xs">
                          {collectionNames && (
                            <div className="flex items-center gap-1">
                              <Bookmark className="h-3 w-3" />
                              <span className="truncate">{collectionNames}</span>
                            </div>
                          )}
                          {query.dbPath && (
                            <div className="truncate">
                              DB: {query.dbPath.split('/').pop()}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <CardAction>
                        <DropdownMenu>
                          <DropdownMenuTrigger onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLoadQuery(query);
                              }}
                            >
                              <Play className="mr-2 h-4 w-4" />
                              Load Query
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => handleCopyQuery(query, e)}
                            >
                              <Copy className="mr-2 h-4 w-4" />
                              Copy to Clipboard
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditDialog(query);
                              }}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                openDeleteDialog(query);
                              }}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </CardAction>
                    </div>
                  </CardHeader>
                </Card>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Edit Query Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Edit Query
            </DialogTitle>
            <DialogDescription>
              Update the query details.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="edit-name" className="text-sm font-medium">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-name"
                value={editFormData.name}
                onChange={(e) => {
                  setEditFormData((prev) => ({ ...prev, name: e.target.value }));
                  setNameError('');
                }}
                placeholder="e.g., User Statistics Query"
                aria-invalid={!!nameError}
                autoFocus
              />
              {nameError && (
                <p className="text-destructive text-xs">{nameError}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="edit-description" className="text-sm font-medium">
                Description
              </Label>
              <Textarea
                id="edit-description"
                value={editFormData.description}
                onChange={(e) =>
                  setEditFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="What does this query do?"
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Favorite Checkbox */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto p-2"
                onClick={() =>
                  setEditFormData((prev) => ({
                    ...prev,
                    isFavorite: !prev.isFavorite,
                  }))
                }
              >
                <Star
                  className={`h-5 w-5 ${
                    editFormData.isFavorite ? 'fill-yellow-400 text-yellow-400' : ''
                  }`}
                />
              </Button>
              <Label className="cursor-pointer text-sm font-medium">
                Mark as favorite
              </Label>
            </div>

            {/* Query Preview */}
            {selectedQuery && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Query</Label>
                <div className="bg-muted text-muted-foreground rounded-md p-3 font-mono text-xs">
                  {getQueryPreview(selectedQuery.queryText)}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={isSaveDisabled}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Pencil className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Query?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedQuery?.name}&quot;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
