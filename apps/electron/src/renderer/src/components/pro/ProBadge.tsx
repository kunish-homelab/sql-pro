import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { Crown } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

const proBadgeVariants = cva(
  'inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none transition-[color,box-shadow] overflow-hidden',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-gradient-to-r from-amber-500 to-yellow-500 text-white',
        outline:
          'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400',
        subtle:
          'border-transparent bg-amber-500/10 text-amber-700 dark:text-amber-400',
      },
      size: {
        default: 'px-2 py-0.5 text-xs',
        sm: 'px-1.5 py-0.5 text-[10px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ProBadgeProps
  extends React.ComponentProps<'span'>, VariantProps<typeof proBadgeVariants> {
  /**
   * Whether to show the crown icon
   * @default true
   */
  showIcon?: boolean;
  /**
   * Custom label for the badge
   * @default "Pro"
   */
  label?: string;
}

/**
 * Badge component to indicate Pro features in the UI.
 * Shows a gold-colored badge with a crown icon.
 */
function ProBadge({
  className,
  variant,
  size,
  showIcon = true,
  label = 'Pro',
  ...props
}: ProBadgeProps) {
  return (
    <span
      data-slot="pro-badge"
      className={cn(proBadgeVariants({ variant, size }), className)}
      {...props}
    >
      {showIcon && <Crown className="h-3 w-3" aria-hidden="true" />}
      <span>{label}</span>
    </span>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- proBadgeVariants is intentionally exported
export { ProBadge, proBadgeVariants };
