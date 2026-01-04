# Font Optimization & Settings

This document describes the optimizations made to the font handling system.

## Overview

The font system has been refactored to:

1. Extract font constants into a centralized module
2. Eliminate code duplication across main and renderer processes
3. Provide consistent font types and utilities
4. Optimize font application with reusable hooks

## Architecture

### Shared Types (`src/shared/types/font.ts`)

Defines common font types used across both main and renderer processes:

- `FontCategory`: System font category ('monospace', 'serif', 'sans-serif', 'display', 'other')
- `SystemFont`: Interface for system fonts with classification
- `FontConfig`: Font family and size configuration
- `FontSettings`: App-level font settings (editor, table, ui)
- `FONT_CATEGORY_LABELS`: UI-friendly category labels

### Font Constants (`src/main/lib/font-constants.ts`)

Main process module containing:

- Font classification sets (MONOSPACE_FONTS, SERIF_FONTS, etc.)
- `classifyFont()`: Efficient font categorization using Set lookups + heuristics
- `CATEGORY_ORDER`: Sorting order for font categories
- Re-exports shared types for type safety

**Optimization**: Uses Set data structure for O(1) lookups instead of array includes.

### Font Application Hook (`src/renderer/src/hooks/useApplyFont.ts`)

React hook utilities for applying fonts:

- `useApplyFont()`: Applies font config to DOM element via CSS variables
- `getFontFamilyCSS()`: Generates properly quoted font-family strings
- `getComputedFont()`: Retrieves computed font from DOM element

**Benefits**:

- Consistent font application across components
- Automatic cleanup on unmount
- Reusable across different components

### Settings Store Integration

Updated `useSettingsStore` to:

- Import shared font types
- Export `FontConfig` and `FontSettings` for type safety
- Maintain separate app font categories (editor, table, ui)
- Support font syncing across categories

## Usage Examples

### Applying fonts in components

```typescript
import { useApplyFont } from '@/hooks/useApplyFont';
import { useEditorFont } from '@/stores';

function MyComponent() {
  const editorFont = useEditorFont();
  useApplyFont(editorFont, 'editor');

  return <div>Content with editor font</div>;
}
```

### Getting font family CSS

```typescript
import { getFontFamilyCSS } from '@/hooks/useApplyFont';

const fontFamily = getFontFamilyCSS(userFont);
// Returns: "Font Name", system-ui, sans-serif
```

### Classifying fonts

```typescript
import { classifyFont } from '@/main/lib/font-constants';

const category = classifyFont('Monaco'); // Returns: 'monospace'
```

## Performance Improvements

1. **Font Classification**: O(1) Set lookups instead of array includes
2. **Code Reusability**: Single source of truth for font types and utilities
3. **Hook Pattern**: Automatic cleanup and dependency optimization
4. **Less Boilerplate**: Shared utilities reduce repetitive font application code

## Migration Notes

- Existing components continue to work without changes
- New components should use `useApplyFont()` hook
- Font constants are now centralized in `src/main/lib/font-constants.ts`
- Settings store maintains backward compatibility with migration logic
