import type { ColumnTypeCategory } from '@/lib/filter-utils';
import { Calendar, Database, Hash, HelpCircle, Type } from 'lucide-react';
import { memo } from 'react';
import { cn } from '@/lib/utils';

interface TypeBadgeProps {
  type: string;
  typeCategory: ColumnTypeCategory;
  className?: string;
}

/**
 * Badge component that displays the column data type with an appropriate icon
 */
export const TypeBadge = memo(
  ({ type, typeCategory, className }: TypeBadgeProps) => {
    // Select icon based on type category
    const Icon = (() => {
      switch (typeCategory) {
        case 'numeric':
          return Hash;
        case 'date':
          return Calendar;
        case 'boolean':
          return Database;
        case 'text':
          return Type;
        case 'unknown':
        default:
          return HelpCircle;
      }
    })();

    // Select color based on type category
    const colorClasses = (() => {
      switch (typeCategory) {
        case 'numeric':
          return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
        case 'date':
          return 'bg-purple-500/10 text-purple-700 dark:text-purple-400';
        case 'boolean':
          return 'bg-green-500/10 text-green-700 dark:text-green-400';
        case 'text':
          return 'bg-amber-500/10 text-amber-700 dark:text-amber-400';
        case 'unknown':
        default:
          return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
      }
    })();

    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase',
          colorClasses,
          className
        )}
        title={`Data type: ${type}`}
      >
        <Icon className="h-2.5 w-2.5" />
        <span>{type}</span>
      </span>
    );
  }
);

TypeBadge.displayName = 'TypeBadge';
