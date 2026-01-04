import type { PendingChange } from '@/types/database';
import { Button } from '@sqlpro/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@sqlpro/ui/tooltip';
import { Redo2, Undo2 } from 'lucide-react';
import { memo, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useUndoRedoStore } from '@/stores';

interface UndoRedoControlsProps {
  className?: string;
  onUndo?: (changes: PendingChange[]) => void;
  onRedo?: (changes: PendingChange[]) => void;
}

export const UndoRedoControls = memo(
  ({ className, onUndo, onRedo }: UndoRedoControlsProps) => {
    const {
      canUndo,
      canRedo,
      undo,
      redo,
      getUndoDescription,
      getRedoDescription,
    } = useUndoRedoStore();

    const handleUndo = useCallback(() => {
      const entry = undo();
      if (entry && onUndo) {
        onUndo(entry.changes);
      }
    }, [onUndo, undo]);

    const handleRedo = useCallback(() => {
      const entry = redo();
      if (entry && onRedo) {
        onRedo(entry.changes);
      }
    }, [onRedo, redo]);

    // Keyboard shortcuts
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
          if (e.shiftKey) {
            // Redo: Cmd/Ctrl+Shift+Z
            e.preventDefault();
            if (canRedo()) {
              handleRedo();
            }
          } else {
            // Undo: Cmd/Ctrl+Z
            e.preventDefault();
            if (canUndo()) {
              handleUndo();
            }
          }
        } else if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
          // Alternative Redo: Cmd/Ctrl+Y
          e.preventDefault();
          if (canRedo()) {
            handleRedo();
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [canRedo, canUndo, handleRedo, handleUndo]);

    const undoDescription = getUndoDescription();
    const redoDescription = getRedoDescription();
    const hasUndo = canUndo();
    const hasRedo = canRedo();

    return (
      <div className={cn('flex items-center gap-1', className)}>
        <TooltipProvider delay={300}>
          <Tooltip>
            <TooltipTrigger>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleUndo}
                disabled={!hasUndo}
              >
                <Undo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {hasUndo ? (
                <div className="flex flex-col gap-0.5">
                  <span>Undo: {undoDescription}</span>
                  <span className="text-muted-foreground text-xs">⌘Z</span>
                </div>
              ) : (
                <span>Nothing to undo</span>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider delay={300}>
          <Tooltip>
            <TooltipTrigger>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleRedo}
                disabled={!hasRedo}
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {hasRedo ? (
                <div className="flex flex-col gap-0.5">
                  <span>Redo: {redoDescription}</span>
                  <span className="text-muted-foreground text-xs">⌘⇧Z</span>
                </div>
              ) : (
                <span>Nothing to redo</span>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }
);
