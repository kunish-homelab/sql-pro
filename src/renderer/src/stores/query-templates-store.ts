import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface QueryTemplate {
  id: string;
  name: string;
  description: string;
  query: string;
  category: TemplateCategory;
  isBuiltIn: boolean;
  createdAt: number;
  updatedAt: number;
}

export type TemplateCategory =
  | 'select'
  | 'insert'
  | 'update'
  | 'delete'
  | 'schema'
  | 'analysis'
  | 'maintenance'
  | 'custom';

interface QueryTemplatesState {
  templates: QueryTemplate[];
  searchQuery: string;
  selectedCategory: TemplateCategory | 'all';

  // Actions
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: TemplateCategory | 'all') => void;
  addTemplate: (
    template: Omit<
      QueryTemplate,
      'id' | 'createdAt' | 'updatedAt' | 'isBuiltIn'
    >
  ) => string;
  updateTemplate: (
    id: string,
    updates: Partial<Omit<QueryTemplate, 'id' | 'isBuiltIn' | 'createdAt'>>
  ) => void;
  deleteTemplate: (id: string) => void;
  duplicateTemplate: (id: string) => string;
  getFilteredTemplates: () => QueryTemplate[];
  resetToDefaults: () => void;
}

const generateId = (): string => {
  return `template-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

// Built-in templates for common SQL operations
const BUILT_IN_TEMPLATES: QueryTemplate[] = [
  // SELECT templates
  {
    id: 'builtin-select-all',
    name: 'Select All',
    description: 'Select all rows from a table',
    query: 'SELECT * FROM table_name;',
    category: 'select',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'builtin-select-columns',
    name: 'Select Specific Columns',
    description: 'Select specific columns from a table',
    query:
      'SELECT column1, column2, column3\nFROM table_name\nWHERE condition;',
    category: 'select',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'builtin-select-join',
    name: 'Inner Join',
    description: 'Join two tables on a common column',
    query:
      'SELECT t1.column1, t2.column2\nFROM table1 t1\nINNER JOIN table2 t2 ON t1.id = t2.table1_id;',
    category: 'select',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'builtin-select-left-join',
    name: 'Left Join',
    description: 'Left join two tables',
    query:
      'SELECT t1.column1, t2.column2\nFROM table1 t1\nLEFT JOIN table2 t2 ON t1.id = t2.table1_id;',
    category: 'select',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'builtin-select-group',
    name: 'Group By with Count',
    description: 'Group rows and count occurrences',
    query:
      'SELECT column_name, COUNT(*) as count\nFROM table_name\nGROUP BY column_name\nORDER BY count DESC;',
    category: 'select',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'builtin-select-subquery',
    name: 'Subquery Example',
    description: 'Select with subquery in WHERE clause',
    query:
      'SELECT *\nFROM table_name\nWHERE column_name IN (\n  SELECT column_name\n  FROM other_table\n  WHERE condition\n);',
    category: 'select',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
  },

  // INSERT templates
  {
    id: 'builtin-insert-single',
    name: 'Insert Single Row',
    description: 'Insert a single row into a table',
    query:
      "INSERT INTO table_name (column1, column2, column3)\nVALUES ('value1', 'value2', 'value3');",
    category: 'insert',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'builtin-insert-multiple',
    name: 'Insert Multiple Rows',
    description: 'Insert multiple rows at once',
    query:
      "INSERT INTO table_name (column1, column2)\nVALUES\n  ('value1a', 'value2a'),\n  ('value1b', 'value2b'),\n  ('value1c', 'value2c');",
    category: 'insert',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'builtin-insert-select',
    name: 'Insert from Select',
    description: 'Insert rows from another table',
    query:
      'INSERT INTO destination_table (column1, column2)\nSELECT column1, column2\nFROM source_table\nWHERE condition;',
    category: 'insert',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
  },

  // UPDATE templates
  {
    id: 'builtin-update-single',
    name: 'Update Single Column',
    description: 'Update a single column value',
    query: "UPDATE table_name\nSET column_name = 'new_value'\nWHERE condition;",
    category: 'update',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'builtin-update-multiple',
    name: 'Update Multiple Columns',
    description: 'Update multiple columns at once',
    query:
      "UPDATE table_name\nSET\n  column1 = 'value1',\n  column2 = 'value2',\n  column3 = 'value3'\nWHERE condition;",
    category: 'update',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
  },

  // DELETE templates
  {
    id: 'builtin-delete-where',
    name: 'Delete with Condition',
    description: 'Delete rows matching a condition',
    query: 'DELETE FROM table_name\nWHERE condition;',
    category: 'delete',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'builtin-delete-all',
    name: 'Delete All Rows',
    description: 'Delete all rows from a table (use with caution!)',
    query: 'DELETE FROM table_name;',
    category: 'delete',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
  },

  // Schema templates
  {
    id: 'builtin-create-table',
    name: 'Create Table',
    description: 'Create a new table with common columns',
    query:
      'CREATE TABLE table_name (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  name TEXT NOT NULL,\n  description TEXT,\n  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,\n  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP\n);',
    category: 'schema',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'builtin-create-index',
    name: 'Create Index',
    description: 'Create an index on a column',
    query: 'CREATE INDEX idx_table_column\nON table_name (column_name);',
    category: 'schema',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'builtin-alter-table',
    name: 'Add Column',
    description: 'Add a new column to an existing table',
    query: 'ALTER TABLE table_name\nADD COLUMN new_column TEXT;',
    category: 'schema',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'builtin-drop-table',
    name: 'Drop Table',
    description: 'Delete a table (use with caution!)',
    query: 'DROP TABLE IF EXISTS table_name;',
    category: 'schema',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
  },

  // Analysis templates
  {
    id: 'builtin-count-rows',
    name: 'Count Rows',
    description: 'Count total rows in a table',
    query: 'SELECT COUNT(*) as total_rows\nFROM table_name;',
    category: 'analysis',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'builtin-distinct-values',
    name: 'Distinct Values',
    description: 'Get distinct values from a column',
    query:
      'SELECT DISTINCT column_name, COUNT(*) as count\nFROM table_name\nGROUP BY column_name\nORDER BY count DESC;',
    category: 'analysis',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'builtin-null-count',
    name: 'Count NULL Values',
    description: 'Count NULL values in a column',
    query:
      'SELECT\n  COUNT(*) as total_rows,\n  SUM(CASE WHEN column_name IS NULL THEN 1 ELSE 0 END) as null_count,\n  SUM(CASE WHEN column_name IS NOT NULL THEN 1 ELSE 0 END) as non_null_count\nFROM table_name;',
    category: 'analysis',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'builtin-top-n',
    name: 'Top N Records',
    description: 'Get top N records by a column',
    query: 'SELECT *\nFROM table_name\nORDER BY column_name DESC\nLIMIT 10;',
    category: 'analysis',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'builtin-date-range',
    name: 'Date Range Query',
    description: 'Query records within a date range',
    query:
      "SELECT *\nFROM table_name\nWHERE date_column BETWEEN '2024-01-01' AND '2024-12-31'\nORDER BY date_column;",
    category: 'analysis',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
  },

  // Maintenance templates
  {
    id: 'builtin-vacuum',
    name: 'Vacuum Database',
    description: 'Reclaim unused space and defragment',
    query: 'VACUUM;',
    category: 'maintenance',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'builtin-analyze',
    name: 'Analyze Database',
    description: 'Update query optimizer statistics',
    query: 'ANALYZE;',
    category: 'maintenance',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'builtin-integrity-check',
    name: 'Integrity Check',
    description: 'Check database integrity',
    query: 'PRAGMA integrity_check;',
    category: 'maintenance',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'builtin-table-info',
    name: 'Table Info',
    description: 'Get table column information',
    query: 'PRAGMA table_info(table_name);',
    category: 'maintenance',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'builtin-foreign-keys',
    name: 'List Foreign Keys',
    description: 'Get foreign key information for a table',
    query: 'PRAGMA foreign_key_list(table_name);',
    category: 'maintenance',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'builtin-index-list',
    name: 'List Indexes',
    description: 'Get all indexes for a table',
    query: 'PRAGMA index_list(table_name);',
    category: 'maintenance',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'builtin-explain-query',
    name: 'Explain Query Plan',
    description: 'Show query execution plan',
    query: 'EXPLAIN QUERY PLAN\nSELECT * FROM table_name WHERE condition;',
    category: 'maintenance',
    isBuiltIn: true,
    createdAt: 0,
    updatedAt: 0,
  },
];

export const TEMPLATE_CATEGORIES: {
  value: TemplateCategory | 'all';
  label: string;
}[] = [
  { value: 'all', label: 'All Templates' },
  { value: 'select', label: 'SELECT' },
  { value: 'insert', label: 'INSERT' },
  { value: 'update', label: 'UPDATE' },
  { value: 'delete', label: 'DELETE' },
  { value: 'schema', label: 'Schema' },
  { value: 'analysis', label: 'Analysis' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'custom', label: 'Custom' },
];

export const useQueryTemplatesStore = create<QueryTemplatesState>()(
  persist(
    (set, get) => ({
      templates: [...BUILT_IN_TEMPLATES],
      searchQuery: '',
      selectedCategory: 'all',

      setSearchQuery: (searchQuery) => set({ searchQuery }),

      setSelectedCategory: (selectedCategory) => set({ selectedCategory }),

      addTemplate: (template) => {
        const id = generateId();
        const now = Date.now();
        const newTemplate: QueryTemplate = {
          ...template,
          id,
          isBuiltIn: false,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          templates: [...state.templates, newTemplate],
        }));
        return id;
      },

      updateTemplate: (id, updates) => {
        set((state) => ({
          templates: state.templates.map((t) =>
            t.id === id && !t.isBuiltIn
              ? { ...t, ...updates, updatedAt: Date.now() }
              : t
          ),
        }));
      },

      deleteTemplate: (id) => {
        set((state) => ({
          templates: state.templates.filter((t) => t.id !== id || t.isBuiltIn),
        }));
      },

      duplicateTemplate: (id) => {
        const state = get();
        const templateToDuplicate = state.templates.find((t) => t.id === id);
        if (!templateToDuplicate) return '';

        const newId = generateId();
        const now = Date.now();
        const newTemplate: QueryTemplate = {
          ...templateToDuplicate,
          id: newId,
          name: `${templateToDuplicate.name} (Copy)`,
          isBuiltIn: false,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          templates: [...state.templates, newTemplate],
        }));

        return newId;
      },

      getFilteredTemplates: () => {
        const state = get();
        let filtered = state.templates;

        // Filter by category
        if (state.selectedCategory !== 'all') {
          filtered = filtered.filter(
            (t) => t.category === state.selectedCategory
          );
        }

        // Filter by search query
        if (state.searchQuery.trim()) {
          const query = state.searchQuery.toLowerCase();
          filtered = filtered.filter(
            (t) =>
              t.name.toLowerCase().includes(query) ||
              t.description.toLowerCase().includes(query) ||
              t.query.toLowerCase().includes(query)
          );
        }

        return filtered;
      },

      resetToDefaults: () => {
        set({
          templates: [...BUILT_IN_TEMPLATES],
          searchQuery: '',
          selectedCategory: 'all',
        });
      },
    }),
    {
      name: 'sql-pro-query-templates',
      partialize: (state) => ({
        // Only persist custom templates
        templates: state.templates.filter((t) => !t.isBuiltIn),
      }),
      merge: (persisted, current) => ({
        ...current,
        templates: [
          ...BUILT_IN_TEMPLATES,
          ...((persisted as { templates?: QueryTemplate[] })?.templates || []),
        ],
      }),
    }
  )
);
