/* eslint-disable react/no-array-index-key -- Skeleton components use static generated lists where index keys are safe */
import { Database } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnimatedLoaderProps {
  className?: string;
  text?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * An animated loader with a pulsing database icon
 */
export function AnimatedLoader({
  className,
  text = 'Loading...',
  size = 'md',
}: AnimatedLoaderProps) {
  const sizeClasses = {
    sm: { icon: 'h-6 w-6', text: 'text-xs', container: 'gap-2' },
    md: { icon: 'h-10 w-10', text: 'text-sm', container: 'gap-3' },
    lg: { icon: 'h-14 w-14', text: 'text-base', container: 'gap-4' },
  };

  const sizes = sizeClasses[size];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center',
        sizes.container,
        className
      )}
    >
      <div className="relative">
        {/* Spinning ring */}
        <div className={cn('absolute inset-0', sizes.icon)}>
          <svg className="animate-spin" viewBox="0 0 50 50">
            <circle
              className="stroke-primary/20"
              strokeWidth="4"
              fill="none"
              r="20"
              cx="25"
              cy="25"
            />
            <circle
              className="stroke-primary"
              strokeWidth="4"
              fill="none"
              r="20"
              cx="25"
              cy="25"
              strokeLinecap="round"
              strokeDasharray="80, 200"
              strokeDashoffset="0"
            />
          </svg>
        </div>
        {/* Pulsing center icon */}
        <Database className={cn('text-primary animate-pulse', sizes.icon)} />
      </div>
      <span className={cn('text-muted-foreground animate-pulse', sizes.text)}>
        {text}
      </span>
    </div>
  );
}

interface SkeletonRowProps {
  columns: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Animated skeleton row for table loading states
 */
export function SkeletonRow({ columns, className, style }: SkeletonRowProps) {
  return (
    <div
      className={cn('flex h-9 animate-pulse items-center border-b', className)}
      style={style}
    >
      {/* Checkbox skeleton */}
      <div className="w-10 shrink-0 px-2">
        <div className="bg-muted h-4 w-4 rounded" />
      </div>
      {/* Column skeletons */}
      {Array.from({ length: columns }).map((_, i) => (
        <div
          key={`skeleton-col-${i}`}
          className="flex-1 px-2"
          style={{
            animationDelay: `${i * 50}ms`,
          }}
        >
          <div
            className="bg-muted h-4 rounded"
            style={{
              width: `${Math.random() * 40 + 40}%`,
            }}
          />
        </div>
      ))}
    </div>
  );
}

interface SkeletonTableProps {
  columns?: number;
  rows?: number;
  className?: string;
}

/**
 * Full table skeleton for loading states
 */
export function SkeletonTable({
  columns = 5,
  rows = 10,
  className,
}: SkeletonTableProps) {
  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header skeleton */}
      <div className="bg-muted/50 flex h-10 items-center border-b">
        <div className="w-10 shrink-0 px-2">
          <div className="bg-muted-foreground/20 h-4 w-4 rounded" />
        </div>
        {Array.from({ length: columns }).map((_, i) => (
          <div key={`skeleton-header-${i}`} className="flex-1 px-2">
            <div
              className="bg-muted-foreground/20 h-4 rounded"
              style={{ width: `${Math.random() * 30 + 50}%` }}
            />
          </div>
        ))}
      </div>
      {/* Row skeletons */}
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow
          key={`skeleton-row-${i}`}
          columns={columns}
          className="animate-in fade-in duration-300"
          style={
            {
              animationDelay: `${i * 30}ms`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

interface FadeTransitionProps {
  show: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Fade in/out transition wrapper
 */
export function FadeTransition({
  show,
  children,
  className,
}: FadeTransitionProps) {
  if (!show) return null;

  return (
    <div className={cn('animate-in fade-in duration-200', className)}>
      {children}
    </div>
  );
}

interface SlideTransitionProps {
  show: boolean;
  children: React.ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right';
  className?: string;
}

/**
 * Slide transition wrapper with directional animation
 */
export function SlideTransition({
  show,
  children,
  direction = 'up',
  className,
}: SlideTransitionProps) {
  if (!show) return null;

  const directionClass = {
    up: 'animate-in slide-in-from-bottom-2',
    down: 'animate-in slide-in-from-top-2',
    left: 'animate-in slide-in-from-right-2',
    right: 'animate-in slide-in-from-left-2',
  };

  return (
    <div className={cn(directionClass[direction], 'duration-200', className)}>
      {children}
    </div>
  );
}

interface PulseHighlightProps {
  children: React.ReactNode;
  active?: boolean;
  className?: string;
}

/**
 * Adds a pulse highlight effect to indicate new/changed content
 */
export function PulseHighlight({
  children,
  active = false,
  className,
}: PulseHighlightProps) {
  return (
    <div className={cn('relative', active && 'animate-highlight', className)}>
      {children}
      {active && (
        <div className="bg-primary/10 pointer-events-none absolute inset-0 animate-ping rounded" />
      )}
    </div>
  );
}
