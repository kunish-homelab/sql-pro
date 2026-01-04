/**
 * Database Type Selector
 * Allows users to select which type of database to connect to
 */

import type { DatabaseType } from '@shared/types';
import { Button } from '@sqlpro/ui/button';
import { Cloud, Database, Server } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface DatabaseTypeOption {
  type: DatabaseType;
  name: string;
  description: string;
  icon: typeof Database;
  color: string;
}

const DATABASE_TYPES: DatabaseTypeOption[] = [
  {
    type: 'sqlite',
    name: 'SQLite',
    description: 'Local file-based database',
    icon: Database,
    color: 'text-blue-500',
  },
  {
    type: 'mysql',
    name: 'MySQL',
    description: 'MySQL/MariaDB server',
    icon: Server,
    color: 'text-orange-500',
  },
  {
    type: 'postgresql',
    name: 'PostgreSQL',
    description: 'PostgreSQL server',
    icon: Server,
    color: 'text-indigo-500',
  },
  {
    type: 'supabase',
    name: 'Supabase',
    description: 'Supabase PostgreSQL',
    icon: Cloud,
    color: 'text-green-500',
  },
];

interface DatabaseTypeSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (type: DatabaseType) => void;
}

export function DatabaseTypeSelector({
  open,
  onOpenChange,
  onSelect,
}: DatabaseTypeSelectorProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select Database Type</DialogTitle>
          <DialogDescription>
            Choose the type of database you want to connect to
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 pt-4">
          {DATABASE_TYPES.map((option) => {
            const Icon = option.icon;
            return (
              <Button
                key={option.type}
                variant="outline"
                className="flex h-auto flex-col items-center gap-2 p-4"
                onClick={() => {
                  onSelect(option.type);
                  onOpenChange(false);
                }}
              >
                <Icon className={cn('h-8 w-8', option.color)} />
                <div className="text-center">
                  <div className="font-medium">{option.name}</div>
                  <div className="text-muted-foreground text-xs">
                    {option.description}
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
