import type { QueryCollection } from '@shared/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@sqlpro/ui/alert-dialog';
import { Button } from '@sqlpro/ui/button';
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@sqlpro/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@sqlpro/ui/dropdown-menu';
import { Input } from '@sqlpro/ui/input';
import { Label } from '@sqlpro/ui/label';
import { ScrollArea } from '@sqlpro/ui/scroll-area';
import { Skeleton } from '@sqlpro/ui/skeleton';
import { Textarea } from '@sqlpro/ui/textarea';
import {
  Folder,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCollectionsStore } from '@/stores/collections-store';
import { useSavedQueriesStore } from '@/stores/saved-queries-store';

const DEFAULT_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#6366f1', // indigo
  '#14b8a6', // teal
];

const DEFAULT_ICON = 'folder';

interface CollectionFormData {
  name: string;
  description: string;
  color: string;
  icon: string;
}

export function CollectionsList() {
  // Store state
  const {
    collections,
    isLoading,
    loadCollections,
    saveCollection,
    updateCollection,
    deleteCollection,
    selectedCollectionId,
    setSelectedCollection,
  } = useCollectionsStore();
  const { savedQueries } = useSavedQueriesStore();

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCollection, setSelectedCollectionForEdit] =
    useState<QueryCollection | null>(null);

  // Form state
  const [formData, setFormData] = useState<CollectionFormData>({
    name: '',
    description: '',
    color: DEFAULT_COLORS[0],
    icon: DEFAULT_ICON,
  });
  const [nameError, setNameError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Load collections on mount
  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  // Reset form when dialogs close
  useEffect(() => {
    if (!createDialogOpen && !editDialogOpen) {
      setFormData({
        name: '',
        description: '',
        color: DEFAULT_COLORS[0],
        icon: DEFAULT_ICON,
      });
      setNameError('');
      setSelectedCollectionForEdit(null);
    }
  }, [createDialogOpen, editDialogOpen]);

  // Populate form when editing
  useEffect(() => {
    if (editDialogOpen && selectedCollection) {
      setFormData({
        name: selectedCollection.name,
        description: selectedCollection.description || '',
        color: selectedCollection.color || DEFAULT_COLORS[0],
        icon: selectedCollection.icon || DEFAULT_ICON,
      });
    }
  }, [editDialogOpen, selectedCollection]);

  const validateForm = useCallback((): boolean => {
    if (!formData.name.trim()) {
      setNameError('Collection name is required');
      return false;
    }
    setNameError('');
    return true;
  }, [formData.name]);

  const handleCreate = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);

    try {
      await saveCollection({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        color: formData.color,
        icon: formData.icon,
        queryIds: [],
      });
      setCreateDialogOpen(false);
    } catch {
      // Error is already handled by the store
    } finally {
      setIsSaving(false);
    }
  }, [validateForm, saveCollection, formData]);

  const handleEdit = useCallback(async () => {
    if (!validateForm() || !selectedCollection) {
      return;
    }

    setIsSaving(true);

    try {
      await updateCollection(selectedCollection.id, {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        color: formData.color,
        icon: formData.icon,
      });
      setEditDialogOpen(false);
    } catch {
      // Error is already handled by the store
    } finally {
      setIsSaving(false);
    }
  }, [validateForm, updateCollection, selectedCollection, formData]);

  const handleDelete = useCallback(async () => {
    if (!selectedCollection) {
      return;
    }

    try {
      await deleteCollection(selectedCollection.id);
      setDeleteDialogOpen(false);
    } catch {
      // Error is already handled by the store
    }
  }, [deleteCollection, selectedCollection]);

  const handleCollectionClick = useCallback(
    (collectionId: string) => {
      if (selectedCollectionId === collectionId) {
        setSelectedCollection(null);
      } else {
        setSelectedCollection(collectionId);
      }
    },
    [selectedCollectionId, setSelectedCollection]
  );

  const openEditDialog = useCallback((collection: QueryCollection) => {
    setSelectedCollectionForEdit(collection);
    setEditDialogOpen(true);
  }, []);

  const openDeleteDialog = useCallback((collection: QueryCollection) => {
    setSelectedCollectionForEdit(collection);
    setDeleteDialogOpen(true);
  }, []);

  const getQueryCountForCollection = useCallback(
    (collectionId: string): number => {
      return savedQueries.filter((q) =>
        (q.collectionIds ?? []).includes(collectionId)
      ).length;
    },
    [savedQueries]
  );

  const isSaveDisabled = isSaving || !formData.name.trim();

  return (
    <div className="grid h-full min-w-40 grid-rows-[auto_1fr]">
      {/* Header */}
      <div className="border-b p-3">
        <div className="flex flex-col gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">Collections</h2>
            <p className="text-muted-foreground truncate text-xs">
              Organize queries
            </p>
          </div>
          <Button
            onClick={() => setCreateDialogOpen(true)}
            size="sm"
            className="w-full"
          >
            <Plus className="mr-1 h-4 w-4" />
            New
          </Button>
        </div>
      </div>

      {/* Collections List */}
      {isLoading ? (
        <div className="overflow-auto">
          <div className="space-y-3 p-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={index} size="sm">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-5 w-2/3" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-8 w-8 shrink-0 rounded" />
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      ) : collections.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-4 text-center">
          <Folder className="text-muted-foreground/50 h-8 w-8 shrink-0" />
          <h3 className="mt-2 text-sm font-medium">No collections</h3>
          <p className="text-muted-foreground mt-1 text-xs">
            Create one to organize queries
          </p>
        </div>
      ) : (
        <ScrollArea className="h-full">
          <div className="space-y-3 p-4">
            {collections.map((collection) => {
              const queryCount = getQueryCountForCollection(collection.id);
              const isSelected = selectedCollectionId === collection.id;

              return (
                <Card
                  key={collection.id}
                  size="sm"
                  className={`hover:bg-accent cursor-pointer transition-colors ${
                    isSelected ? 'ring-primary ring-2 ring-offset-2' : ''
                  }`}
                  onClick={() => handleCollectionClick(collection.id)}
                >
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      {/* Color indicator & Icon */}
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-white"
                        style={{
                          backgroundColor:
                            collection.color || DEFAULT_COLORS[0],
                        }}
                      >
                        <Folder className="h-5 w-5" />
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <CardTitle>{collection.name}</CardTitle>
                        {collection.description && (
                          <CardDescription className="mt-1">
                            {collection.description}
                          </CardDescription>
                        )}
                        <div className="text-muted-foreground mt-2 text-xs">
                          {queryCount} {queryCount === 1 ? 'query' : 'queries'}
                        </div>
                      </div>

                      {/* Actions */}
                      <CardAction>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditDialog(collection);
                              }}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                openDeleteDialog(collection);
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
            })}
          </div>
        </ScrollArea>
      )}

      {/* Create Collection Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5" />
              Create Collection
            </DialogTitle>
            <DialogDescription>
              Create a new collection to organize your saved queries.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="create-name" className="text-sm font-medium">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="create-name"
                value={formData.name}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, name: e.target.value }));
                  setNameError('');
                }}
                placeholder="e.g., User Queries"
                aria-invalid={!!nameError}
                autoFocus
              />
              {nameError && (
                <p className="text-destructive text-xs">{nameError}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label
                htmlFor="create-description"
                className="text-sm font-medium"
              >
                Description
              </Label>
              <Textarea
                id="create-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="What is this collection for?"
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Color */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Color</Label>
              <div className="flex gap-2">
                {DEFAULT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`h-8 w-8 rounded-full transition-transform hover:scale-110 ${
                      formData.color === color
                        ? 'ring-primary ring-2 ring-offset-2'
                        : ''
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData((prev) => ({ ...prev, color }))}
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSaveDisabled}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Create
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Collection Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Edit Collection
            </DialogTitle>
            <DialogDescription>
              Update the collection details.
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
                value={formData.name}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, name: e.target.value }));
                  setNameError('');
                }}
                placeholder="e.g., User Queries"
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
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="What is this collection for?"
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Color */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Color</Label>
              <div className="flex gap-2">
                {DEFAULT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`h-8 w-8 rounded-full transition-transform hover:scale-110 ${
                      formData.color === color
                        ? 'ring-primary ring-2 ring-offset-2'
                        : ''
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData((prev) => ({ ...prev, color }))}
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>
            </div>
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
            <AlertDialogTitle>Delete Collection?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedCollection?.name}
              &quot;?
              {selectedCollection &&
                getQueryCountForCollection(selectedCollection.id) > 0 && (
                  <>
                    {' '}
                    The queries in this collection will not be deleted, but they
                    will be removed from this collection.
                  </>
                )}
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
