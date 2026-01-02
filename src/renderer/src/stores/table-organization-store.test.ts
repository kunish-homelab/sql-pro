import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useTableOrganizationStore } from './table-organization-store';

describe('useTableOrganizationStore', () => {
  beforeEach(() => {
    // Reset the store before each test
    const { result } = renderHook(() => useTableOrganizationStore());
    act(() => {
      result.current.setSortOption('name-asc');
      result.current.setActiveTagFilter(null);
      // Clear all tags
      result.current.availableTags.forEach((tag) => {
        result.current.removeTag(tag);
      });
    });
  });

  describe('sort options', () => {
    it('should initialize with name-asc sort option', () => {
      const { result } = renderHook(() => useTableOrganizationStore());
      expect(result.current.sortOption).toBe('name-asc');
    });

    it('should change sort option', () => {
      const { result } = renderHook(() => useTableOrganizationStore());
      act(() => {
        result.current.setSortOption('row-count-desc');
      });
      expect(result.current.sortOption).toBe('row-count-desc');
    });
  });

  describe('tag management', () => {
    it('should add a new tag', () => {
      const { result } = renderHook(() => useTableOrganizationStore());
      act(() => {
        result.current.addTag('important');
      });
      expect(result.current.availableTags).toContain('important');
    });

    it('should not add duplicate tags', () => {
      const { result } = renderHook(() => useTableOrganizationStore());
      act(() => {
        result.current.addTag('important');
        result.current.addTag('important');
      });
      expect(
        result.current.availableTags.filter((t) => t === 'important').length
      ).toBe(1);
    });

    it('should remove a tag', () => {
      const { result } = renderHook(() => useTableOrganizationStore());
      act(() => {
        result.current.addTag('toremove');
      });
      expect(result.current.availableTags).toContain('toremove');
      act(() => {
        result.current.removeTag('toremove');
      });
      expect(result.current.availableTags).not.toContain('toremove');
    });

    it('should rename a tag', () => {
      const { result } = renderHook(() => useTableOrganizationStore());
      act(() => {
        result.current.addTag('oldname');
      });
      act(() => {
        result.current.renameTag('oldname', 'newname');
      });
      expect(result.current.availableTags).not.toContain('oldname');
      expect(result.current.availableTags).toContain('newname');
    });
  });

  describe('table metadata', () => {
    const tableKey = 'test.db:main:users';

    it('should add a tag to a table', () => {
      const { result } = renderHook(() => useTableOrganizationStore());
      act(() => {
        result.current.addTableTag(tableKey, 'important');
      });
      const metadata = result.current.getTableMetadata(tableKey);
      expect(metadata.tags).toContain('important');
    });

    it('should remove a tag from a table', () => {
      const { result } = renderHook(() => useTableOrganizationStore());
      act(() => {
        result.current.addTableTag(tableKey, 'toremove');
      });
      act(() => {
        result.current.removeTableTag(tableKey, 'toremove');
      });
      const metadata = result.current.getTableMetadata(tableKey);
      expect(metadata.tags).not.toContain('toremove');
    });

    it('should set table as pinned', () => {
      const { result } = renderHook(() => useTableOrganizationStore());
      act(() => {
        result.current.setTablePinned(tableKey, true);
      });
      const metadata = result.current.getTableMetadata(tableKey);
      expect(metadata.pinned).toBe(true);
    });

    it('should unpin a table', () => {
      const { result } = renderHook(() => useTableOrganizationStore());
      act(() => {
        result.current.setTablePinned(tableKey, true);
      });
      act(() => {
        result.current.setTablePinned(tableKey, false);
      });
      const metadata = result.current.getTableMetadata(tableKey);
      expect(metadata.pinned).toBe(false);
    });
  });

  describe('tag filter', () => {
    it('should set active tag filter', () => {
      const { result } = renderHook(() => useTableOrganizationStore());
      act(() => {
        result.current.addTag('filterme');
        result.current.setActiveTagFilter('filterme');
      });
      expect(result.current.activeTagFilter).toBe('filterme');
    });

    it('should clear active tag filter', () => {
      const { result } = renderHook(() => useTableOrganizationStore());
      act(() => {
        result.current.addTag('filterme');
        result.current.setActiveTagFilter('filterme');
      });
      act(() => {
        result.current.setActiveTagFilter(null);
      });
      expect(result.current.activeTagFilter).toBeNull();
    });
  });

  describe('getTableKey', () => {
    it('should generate correct table key', () => {
      const { result } = renderHook(() => useTableOrganizationStore());
      const key = result.current.getTableKey(
        '/path/to/db.sqlite',
        'main',
        'users'
      );
      expect(key).toBe('/path/to/db.sqlite:main:users');
    });
  });
});
