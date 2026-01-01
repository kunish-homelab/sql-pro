import type { FontCategory, FontConfig } from '@/stores';
import { useEffect } from 'react';

/**
 * Hook to apply font configuration to a DOM element
 * Handles both CSS variables and inline styles for optimal compatibility
 */
export function useApplyFont(
  config: FontConfig,
  category: FontCategory,
  selector?: string
) {
  useEffect(() => {
    const target = selector
      ? document.querySelector(selector)
      : document.documentElement;
    if (!target) return;

    // Apply CSS variables for cascading styles
    const varName = `--font-${category}-family`;
    const sizeVarName = `--font-${category}-size`;

    if (config.family) {
      target.style.setProperty(varName, config.family);
    } else {
      target.style.removeProperty(varName);
    }
    target.style.setProperty(sizeVarName, `${config.size}px`);

    // Return cleanup function
    return () => {
      target.style.removeProperty(varName);
      target.style.removeProperty(sizeVarName);
    };
  }, [config.family, config.size, category, selector]);
}

/**
 * Generates font-family CSS string with fallback
 */
export function getFontFamilyCSS(
  family: string | null | undefined
): string | undefined {
  if (!family) return undefined;
  return `"${family}", system-ui, sans-serif`;
}

/**
 * Gets computed font configuration from a DOM element
 */
export function getComputedFont(selector: string): FontConfig | null {
  const element = document.querySelector(selector);
  if (!element) return null;

  const style = window.getComputedStyle(element);
  const fontSize = style.fontSize.replace('px', '');

  return {
    family: style.fontFamily,
    size: Number.parseInt(fontSize, 10) || 14,
  };
}
