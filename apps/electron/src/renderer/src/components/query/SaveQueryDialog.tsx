import { Button } from '@sqlpro/ui/button';
import { Checkbox } from '@sqlpro/ui/checkbox';
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from '@sqlpro/ui/combobox';
import { Input } from '@sqlpro/ui/input';
import { Label } from '@sqlpro/ui/label';
import { Textarea } from '@sqlpro/ui/textarea';
import { Bookmark, Loader2, Plus, Star } from 'lucide-react';
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

interface SaveQueryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queryText: string;
  dbPath?: string;
  initialData?: {
    name?: string;
    description?: string;
    isFavorite?: boolean;
    collectionIds?: string[];
  };
}

interface NewCollectionForm {
  name: string;
  description: string;
  color: string;
  icon: string;
}

const DEFAULT_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
];

const DEFAULT_ICONS = ['folder', 'database', 'code', 'star', 'bookmark', 'tag'];

export function SaveQueryDialog({
  open,
  onOpenChange,
  queryText,
  dbPath,
  initialData,
}: SaveQueryDialogProps) {
  // Form state
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(
    initialData?.description || ''
  );
  const [isFavorite, setIsFavorite] = useState(
    initialData?.isFavorite || false
  );
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>(
    initialData?.collectionIds || []
  );

  // New collection form state
  const [showNewCollectionForm, setShowNewCollectionForm] = useState(false);
  const [newCollectionForm, setNewCollectionForm] = useState<NewCollectionForm>(
    {
      name: '',
      description: '',
      color: DEFAULT_COLORS[0],
      icon: DEFAULT_ICONS[0],
    }
  );

  // Validation state
  const [nameError, setNameError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Stores
  const { collections, loadCollections, saveCollection } =
    useCollectionsStore();
  const { saveSavedQuery } = useSavedQueriesStore();

  // Combobox anchor for multi-select
  const anchor = useComboboxAnchor();

  // Load collections on mount
  useEffect(() => {
    if (open) {
      loadCollections();
    }
  }, [open, loadCollections]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setName(initialData?.name || '');
      setDescription(initialData?.description || '');
      setIsFavorite(initialData?.isFavorite || false);
      setSelectedCollectionIds(initialData?.collectionIds || []);
      setNameError('');
      setShowNewCollectionForm(false);
      setNewCollectionForm({
        name: '',
        description: '',
        color: DEFAULT_COLORS[0],
        icon: DEFAULT_ICONS[0],
      });
    }
  }, [open, initialData]);

  const validateForm = useCallback((): boolean => {
    // Name is required
    if (!name.trim()) {
      setNameError('Query name is required');
      return false;
    }

    setNameError('');
    return true;
  }, [name]);

  const handleSave = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);

    try {
      // Save the query
      await saveSavedQuery({
        name: name.trim(),
        queryText,
        description: description.trim() || undefined,
        dbPath,
        isFavorite,
        collectionIds: selectedCollectionIds,
      });

      // Close dialog on success
      onOpenChange(false);
    } catch (error) {
      // Error is already handled by the store with optimistic rollback
      console.error('Failed to save query:', error);
    } finally {
      setIsSaving(false);
    }
  }, [
    validateForm,
    saveSavedQuery,
    name,
    queryText,
    description,
    dbPath,
    isFavorite,
    selectedCollectionIds,
    onOpenChange,
  ]);

  const handleCreateCollection = useCallback(async () => {
    if (!newCollectionForm.name.trim()) {
      return;
    }

    try {
      // Save the new collection
      await saveCollection({
        name: newCollectionForm.name.trim(),
        description: newCollectionForm.description.trim() || undefined,
        color: newCollectionForm.color,
        icon: newCollectionForm.icon,
        queryIds: [],
      });

      // Reload collections to get the new one
      await loadCollections();

      // Reset form
      setNewCollectionForm({
        name: '',
        description: '',
        color: DEFAULT_COLORS[0],
        icon: DEFAULT_ICONS[0],
      });
      setShowNewCollectionForm(false);
    } catch (error) {
      console.error('Failed to create collection:', error);
    }
  }, [newCollectionForm, saveCollection, loadCollections]);

  const handleCollectionToggle = useCallback((collectionId: string) => {
    setSelectedCollectionIds((prev) => {
      if (prev.includes(collectionId)) {
        return prev.filter((id) => id !== collectionId);
      } else {
        return [...prev, collectionId];
      }
    });
  }, []);

  const handleRemoveCollection = useCallback((collectionId: string) => {
    setSelectedCollectionIds((prev) =>
      prev.filter((id) => id !== collectionId)
    );
  }, []);

  const selectedCollections = collections.filter((c) =>
    selectedCollectionIds.includes(c.id)
  );

  const isSaveDisabled = isSaving || !name.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bookmark className="h-5 w-5" />
            Save Query
          </DialogTitle>
          <DialogDescription>
            Save this query to access it later from your saved queries.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Query Name */}
          <div className="space-y-2">
            <Label htmlFor="query-name" className="text-sm font-medium">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="query-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
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
            <Label htmlFor="query-description" className="text-sm font-medium">
              Description
            </Label>
            <Textarea
              id="query-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this query do?"
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Favorite Checkbox */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="is-favorite"
              checked={isFavorite}
              onCheckedChange={(checked) => setIsFavorite(checked === true)}
            />
            <Label
              htmlFor="is-favorite"
              className="flex cursor-pointer items-center gap-2 text-sm font-medium"
            >
              <Star
                className={`h-4 w-4 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`}
              />
              Mark as favorite
            </Label>
          </div>

          {/* Collections Multi-Select */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Collections</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto px-2 py-1 text-xs"
                onClick={() => setShowNewCollectionForm(!showNewCollectionForm)}
              >
                <Plus className="mr-1 h-3 w-3" />
                New Collection
              </Button>
            </div>

            {/* New Collection Form */}
            {showNewCollectionForm && (
              <div className="space-y-3 rounded-md border p-3">
                <div className="space-y-2">
                  <Label htmlFor="new-collection-name" className="text-xs">
                    Collection Name
                  </Label>
                  <Input
                    id="new-collection-name"
                    value={newCollectionForm.name}
                    onChange={(e) =>
                      setNewCollectionForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    placeholder="e.g., Reports"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateCollection}
                    disabled={!newCollectionForm.name.trim()}
                  >
                    Create
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowNewCollectionForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Collections Combobox */}
            <Combobox
              multiple
              value={selectedCollectionIds}
              onValueChange={setSelectedCollectionIds}
            >
              <ComboboxChips ref={anchor}>
                {selectedCollections.map((collection) => (
                  <ComboboxChip
                    key={collection.id}
                    onRemove={() => handleRemoveCollection(collection.id)}
                  >
                    {collection.icon && (
                      <span className="mr-1">{collection.icon}</span>
                    )}
                    {collection.name}
                  </ComboboxChip>
                ))}
                <ComboboxChipsInput placeholder="Select collections..." />
              </ComboboxChips>
              <ComboboxContent anchor={anchor.current}>
                <ComboboxInput showClear showTrigger={false} />
                <ComboboxList>
                  <ComboboxEmpty>No collections found.</ComboboxEmpty>
                  {collections.map((collection) => (
                    <ComboboxItem
                      key={collection.id}
                      value={collection.id}
                      onSelect={() => handleCollectionToggle(collection.id)}
                    >
                      {collection.icon && (
                        <span className="mr-1">{collection.icon}</span>
                      )}
                      <div className="flex flex-col">
                        <span>{collection.name}</span>
                        {collection.description && (
                          <span className="text-muted-foreground text-xs">
                            {collection.description}
                          </span>
                        )}
                      </div>
                    </ComboboxItem>
                  ))}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>

          {/* Database Path Info */}
          {dbPath && (
            <div className="text-muted-foreground bg-muted rounded-md p-2 text-xs">
              <strong>Database:</strong> {dbPath.split('/').pop()}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaveDisabled}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Bookmark className="mr-2 h-4 w-4" />
                Save Query
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
