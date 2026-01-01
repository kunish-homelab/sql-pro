import type { ProFeature } from '@shared/types';
import type { ReactNode } from 'react';
import { Crown, Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useProStore } from '@/stores';
import { ProBadge } from './ProBadge';

/**
 * Human-readable names for Pro features.
 */
const FEATURE_NAMES: Record<ProFeature, string> = {
  'ai-nl-to-sql': 'Natural Language to SQL',
  'ai-data-analysis': 'AI Data Analysis',
  'advanced-export': 'Advanced Export',
  'plugin-system': 'Plugin System',
  'query-optimizer': 'Query Optimizer',
};

/**
 * Descriptions for each Pro feature to display in upgrade prompts.
 */
const FEATURE_DESCRIPTIONS: Record<ProFeature, string> = {
  'ai-nl-to-sql':
    'Convert natural language questions into SQL queries using AI.',
  'ai-data-analysis': 'Get AI-powered insights and analysis of your data.',
  'advanced-export':
    'Export data to Excel, JSON, and other formats with advanced options.',
  'plugin-system': 'Extend functionality with plugins from the marketplace.',
  'query-optimizer':
    'Analyze and optimize your SQL queries for better performance.',
};

interface ProGateProps {
  /**
   * The Pro feature to check access for.
   */
  feature: ProFeature;
  /**
   * Content to render when user has Pro access.
   */
  children: ReactNode;
  /**
   * Optional custom fallback UI to show when user doesn't have Pro access.
   * If not provided, a default upgrade prompt is shown.
   */
  fallback?: ReactNode;
  /**
   * Callback when user clicks the upgrade button.
   * If not provided, the button will have no action.
   */
  onUpgrade?: () => void;
  /**
   * Additional class name for the gate container.
   */
  className?: string;
}

/**
 * Component that gates Pro features.
 * Shows children if user has Pro access for the specified feature,
 * otherwise shows an upgrade prompt (or custom fallback).
 *
 * @example
 * ```tsx
 * <ProGate feature="ai-nl-to-sql" onUpgrade={() => setShowProDialog(true)}>
 *   <NLToSQLContent />
 * </ProGate>
 * ```
 */
export function ProGate({
  feature,
  children,
  fallback,
  onUpgrade,
  className,
}: ProGateProps) {
  const { isPro, hasFeature } = useProStore();

  // Check if user has access to this specific feature
  const hasAccess = isPro && hasFeature(feature);

  // If user has access, render children
  if (hasAccess) {
    return <>{children}</>;
  }

  // If custom fallback provided, render it
  if (fallback !== undefined) {
    return <>{fallback}</>;
  }

  // Render default upgrade prompt
  const featureName = FEATURE_NAMES[feature];
  const featureDescription = FEATURE_DESCRIPTIONS[feature];

  return (
    <div
      data-slot="pro-gate"
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-8 text-center',
        'bg-muted/30 border-amber-500/30',
        className
      )}
    >
      {/* Pro Badge with Lock Icon */}
      <div className="relative">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-amber-500/20 to-yellow-500/20">
          <Crown className="h-8 w-8 text-amber-500" />
        </div>
        <div className="bg-background absolute -right-1 -bottom-1 rounded-full border p-1">
          <Lock className="text-muted-foreground h-3 w-3" />
        </div>
      </div>

      {/* Feature Info */}
      <div className="space-y-2">
        <div className="flex items-center justify-center gap-2">
          <h3 className="text-lg font-semibold">{featureName}</h3>
          <ProBadge size="sm" />
        </div>
        <p className="text-muted-foreground max-w-sm text-sm">
          {featureDescription}
        </p>
      </div>

      {/* Upgrade CTA */}
      <div className="flex flex-col items-center gap-2">
        <Button
          onClick={onUpgrade}
          className="bg-linear-to-r from-amber-500 to-yellow-500 text-white hover:from-amber-600 hover:to-yellow-600"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Upgrade to Pro
        </Button>
        <p className="text-muted-foreground text-xs">Unlock all Pro features</p>
      </div>
    </div>
  );
}

/**
 * Inline version of ProGate that renders minimal fallback content.
 * Useful for inline feature gating (e.g., buttons, menu items).
 *
 * @example
 * ```tsx
 * <ProGateInline feature="ai-nl-to-sql" onUpgrade={handleUpgrade}>
 *   <Button onClick={handleNLToSQL}>
 *     <Wand2 className="h-4 w-4" />
 *     NL to SQL
 *   </Button>
 * </ProGateInline>
 * ```
 */
export function ProGateInline({
  feature,
  children,
  fallback,
  onUpgrade,
}: Omit<ProGateProps, 'className'>) {
  const { isPro, hasFeature } = useProStore();
  const hasAccess = isPro && hasFeature(feature);

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback !== undefined) {
    return <>{fallback}</>;
  }

  // Default inline fallback: show ProBadge that opens upgrade
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onUpgrade}
      className="border-amber-500/50 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
    >
      <Lock className="mr-1 h-3 w-3" />
      <ProBadge size="sm" variant="subtle" showIcon={false} />
    </Button>
  );
}
