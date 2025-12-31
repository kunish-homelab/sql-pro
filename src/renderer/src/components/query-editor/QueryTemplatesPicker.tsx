import type { QueryTemplate, TemplateCategory } from '@/stores';
import {
  Code,
  Copy,
  FileText,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
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
import { SqlHighlight } from '@/components/ui/sql-highlight';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { TEMPLATE_CATEGORIES, useQueryTemplatesStore } from '@/stores';

interface QueryTemplatesPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (query: string) => void;
}

const CATEGORY_COLORS: Record<TemplateCategory | 'all', string> = {
  all: 'bg-gray-100 text-gray-700',
  select: 'bg-blue-100 text-blue-700',
  insert: 'bg-green-100 text-green-700',
  update: 'bg-amber-100 text-amber-700',
  delete: 'bg-red-100 text-red-700',
  schema: 'bg-purple-100 text-purple-700',
  analysis: 'bg-cyan-100 text-cyan-700',
  maintenance: 'bg-gray-100 text-gray-700',
  custom: 'bg-pink-100 text-pink-700',
};

interface TemplateCardProps {
  template: QueryTemplate;
  onSelect: (query: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

const TemplateCard = memo(
  ({ template, onSelect, onDuplicate, onDelete }: TemplateCardProps) => {
    return (
      <div
        className={cn(
          'group hover:border-primary/50 hover:bg-accent/30 relative flex cursor-pointer flex-col gap-2.5 rounded-xl border p-4 transition-all duration-200',
          template.isBuiltIn && 'border-dashed'
        )}
        onClick={() => onSelect(template.query)}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {template.isBuiltIn ? (
              <Star className="h-4 w-4 shrink-0 text-amber-500" />
            ) : (
              <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
            )}
            <span className="truncate font-medium">{template.name}</span>
          </div>
          <Badge
            variant="secondary"
            className={cn(
              'shrink-0 text-[10px] font-medium',
              CATEGORY_COLORS[template.category]
            )}
          >
            {template.category}
          </Badge>
        </div>

        {/* Description */}
        <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
          {template.description}
        </p>

        {/* Code Preview */}
        <SqlHighlight
          code={template.query}
          maxLines={3}
          className="bg-muted/50 rounded-lg p-2.5 text-xs"
        />

        {/* Actions - appear on hover */}
        <div className="bg-background/80 absolute top-2 right-2 flex items-center gap-0.5 rounded-md opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
          <TooltipProvider delay={200}>
            <Tooltip>
              <TooltipTrigger>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate(template.id);
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Duplicate template</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {!template.isBuiltIn && (
            <TooltipProvider delay={200}>
              <Tooltip>
                <TooltipTrigger>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500 hover:text-red-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(template.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete template</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
    );
  }
);

interface NewTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuery?: string;
}

function NewTemplateDialog({
  open,
  onOpenChange,
  initialQuery = '',
}: NewTemplateDialogProps) {
  const { addTemplate } = useQueryTemplatesStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<TemplateCategory>('custom');

  const handleSubmit = useCallback(() => {
    if (!name.trim() || !query.trim()) return;

    addTemplate({
      name: name.trim(),
      description: description.trim(),
      query: query.trim(),
      category,
    });

    setName('');
    setDescription('');
    setQuery('');
    setCategory('custom');
    onOpenChange(false);
  }, [addTemplate, category, description, name, onOpenChange, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Query Template</DialogTitle>
          <DialogDescription>
            Save a reusable SQL query template for quick access.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Query Template"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this query does"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={category}
              onValueChange={(value) => setCategory(value as TemplateCategory)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATE_CATEGORIES.filter((c) => c.value !== 'all').map(
                  (cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="query">SQL Query</Label>
            <Textarea
              id="query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="SELECT * FROM table_name;"
              className="min-h-[120px] font-mono"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || !query.trim()}
          >
            Create Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const QueryTemplatesPicker = memo(
  ({ open, onOpenChange, onSelect }: QueryTemplatesPickerProps) => {
    const {
      searchQuery,
      selectedCategory,
      setSearchQuery,
      setSelectedCategory,
      getFilteredTemplates,
      duplicateTemplate,
      deleteTemplate,
    } = useQueryTemplatesStore();

    const [showNewDialog, setShowNewDialog] = useState(false);

    const filteredTemplates = useMemo(
      () => getFilteredTemplates(),
      [getFilteredTemplates]
    );

    const handleSelect = useCallback(
      (query: string) => {
        onSelect(query);
        onOpenChange(false);
      },
      [onOpenChange, onSelect]
    );

    const handleDuplicate = useCallback(
      (id: string) => {
        duplicateTemplate(id);
      },
      [duplicateTemplate]
    );

    const handleDelete = useCallback(
      (id: string) => {
        deleteTemplate(id);
      },
      [deleteTemplate]
    );

    return (
      <>
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="max-w-4xl p-0">
            <DialogHeader className="border-b px-6 py-4">
              <DialogTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Query Templates
              </DialogTitle>
              <DialogDescription>
                Choose a template to quickly insert common SQL queries.
              </DialogDescription>
            </DialogHeader>

            {/* Search and Filter */}
            <div className="flex flex-col gap-3 border-b px-6 py-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1/2 right-1 h-6 w-6 -translate-y-1/2"
                    onClick={() => setSearchQuery('')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={selectedCategory}
                  onValueChange={(value) =>
                    setSelectedCategory(value as TemplateCategory | 'all')
                  }
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={() => setShowNewDialog(true)} size="sm">
                  <Plus className="mr-1 h-4 w-4" />
                  New
                </Button>
              </div>
            </div>

            {/* Template Grid */}
            <div className="max-h-[60vh] overflow-y-auto p-6">
              {filteredTemplates.length === 0 ? (
                <div className="text-muted-foreground flex flex-col items-center justify-center py-16">
                  <FileText className="mb-3 h-12 w-12 opacity-40" />
                  <p className="font-medium">No templates found</p>
                  <p className="text-sm opacity-70">
                    Try adjusting your search or category
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {filteredTemplates.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      onSelect={handleSelect}
                      onDuplicate={handleDuplicate}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <NewTemplateDialog
          open={showNewDialog}
          onOpenChange={setShowNewDialog}
        />
      </>
    );
  }
);
