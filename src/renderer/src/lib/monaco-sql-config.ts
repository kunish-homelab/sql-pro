import type * as Monaco from 'monaco-editor';
import type { DatabaseSchema, TableSchema } from '@/types/database';

/**
 * Represents a table reference extracted from SQL query.
 * Maps alias (or table name if no alias) to the actual table name.
 */
interface TableReference {
  tableName: string;
  alias: string | null;
}

/**
 * Parses SQL text to extract table references from FROM and JOIN clauses.
 * Handles patterns like:
 * - FROM users
 * - FROM users u
 * - FROM users AS u
 * - JOIN orders o ON ...
 */
function parseTableReferences(sql: string): TableReference[] {
  const references: TableReference[] = [];
  const normalizedSql = sql.replace(/\s+/g, ' ').trim();

  // Match FROM table [AS] [alias] and JOIN table [AS] [alias]
  const tablePattern = /(?:FROM|JOIN)\s+(\w+)(?:\s+(?:AS\s+)?(\w+))?/gi;

  let match = tablePattern.exec(normalizedSql);
  while (match !== null) {
    const tableName = match[1];
    const alias = match[2] || null;

    // Skip if the "alias" is actually a SQL keyword
    const keywords = [
      'ON',
      'WHERE',
      'AND',
      'OR',
      'LEFT',
      'RIGHT',
      'INNER',
      'OUTER',
      'CROSS',
      'JOIN',
      'ORDER',
      'GROUP',
      'HAVING',
      'LIMIT',
      'UNION',
      'SET',
      'VALUES',
    ];
    if (alias && keywords.includes(alias.toUpperCase())) {
      references.push({ tableName, alias: null });
    } else {
      references.push({ tableName, alias });
    }
    match = tablePattern.exec(normalizedSql);
  }

  return references;
}

/**
 * Gets the text before the cursor, checking for dot notation (table. or alias.)
 * Returns the prefix before the dot if found.
 */
function getDotPrefix(
  model: Monaco.editor.ITextModel,
  position: Monaco.Position
): string | null {
  const lineContent = model.getLineContent(position.lineNumber);
  const textBeforeCursor = lineContent.substring(0, position.column - 1);

  // Check for pattern: identifier. (cursor right after the dot)
  const dotMatch = textBeforeCursor.match(/(\w+)\.\s*$/);
  return dotMatch ? dotMatch[1] : null;
}

/**
 * Resolves a prefix (table name or alias) to the actual table info.
 */
function resolveTableFromPrefix(
  prefix: string,
  tableRefs: TableReference[],
  schema: DatabaseSchema
): TableSchema | null {
  const lowerPrefix = prefix.toLowerCase();

  // First check if it matches an alias
  for (const ref of tableRefs) {
    if (ref.alias?.toLowerCase() === lowerPrefix) {
      return (
        schema.tables.find(
          (t) => t.name.toLowerCase() === ref.tableName.toLowerCase()
        ) || null
      );
    }
  }

  // Then check if it matches a table name directly
  return (
    schema.tables.find((t) => t.name.toLowerCase() === lowerPrefix) || null
  );
}

/**
 * Gets tables that are in scope (referenced in the current query).
 */
function getTablesInScope(
  tableRefs: TableReference[],
  schema: DatabaseSchema
): TableSchema[] {
  const inScope: TableSchema[] = [];

  for (const ref of tableRefs) {
    const table = schema.tables.find(
      (t) => t.name.toLowerCase() === ref.tableName.toLowerCase()
    );
    if (table && !inScope.includes(table)) {
      inScope.push(table);
    }
  }

  return inScope;
}

// SQL Keywords for autocomplete (US1)
const SQL_KEYWORDS = [
  'SELECT',
  'FROM',
  'WHERE',
  'AND',
  'OR',
  'NOT',
  'IN',
  'LIKE',
  'ORDER BY',
  'GROUP BY',
  'HAVING',
  'LIMIT',
  'OFFSET',
  'INSERT INTO',
  'VALUES',
  'UPDATE',
  'SET',
  'DELETE FROM',
  'CREATE TABLE',
  'DROP TABLE',
  'ALTER TABLE',
  'JOIN',
  'LEFT JOIN',
  'RIGHT JOIN',
  'INNER JOIN',
  'OUTER JOIN',
  'CROSS JOIN',
  'ON',
  'AS',
  'DISTINCT',
  'COUNT',
  'SUM',
  'AVG',
  'MIN',
  'MAX',
  'NULL',
  'IS NULL',
  'IS NOT NULL',
  'BETWEEN',
  'CASE',
  'WHEN',
  'THEN',
  'ELSE',
  'END',
  'EXISTS',
  'UNION',
  'UNION ALL',
  'EXCEPT',
  'INTERSECT',
  'PRIMARY KEY',
  'FOREIGN KEY',
  'REFERENCES',
  'INDEX',
  'UNIQUE',
  'DEFAULT',
  'CHECK',
  'CONSTRAINT',
  'CASCADE',
  'PRAGMA',
  'EXPLAIN',
  'VACUUM',
  'ATTACH',
  'DETACH',
  'BEGIN',
  'COMMIT',
  'ROLLBACK',
  'TRANSACTION',
  'SAVEPOINT',
  'RELEASE',
];

/**
 * Creates a SQL completion provider that suggests SQL keywords, table names, and column names
 * from the connected database schema. (US1: Intelligent Autocomplete)
 *
 * Context-aware features:
 * - After typing "table." or "alias.", only suggests columns from that table
 * - After FROM/JOIN, suggests table names
 * - In WHERE/SELECT with tables in scope, prioritizes in-scope columns
 */
export function createSqlCompletionProvider(
  monaco: typeof Monaco,
  schema: DatabaseSchema | null
): Monaco.languages.CompletionItemProvider {
  return {
    triggerCharacters: ['.'], // Trigger on dot for table.column
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions: Monaco.languages.CompletionItem[] = [];
      const fullText = model.getValue();
      const tableRefs = parseTableReferences(fullText);
      const dotPrefix = getDotPrefix(model, position);

      // Case 1: Typing after "table." or "alias." - only show that table's columns
      if (dotPrefix && schema) {
        const targetTable = resolveTableFromPrefix(
          dotPrefix,
          tableRefs,
          schema
        );
        if (targetTable) {
          targetTable.columns.forEach((column) => {
            suggestions.push({
              label: column.name,
              kind: monaco.languages.CompletionItemKind.Field,
              detail: column.type,
              documentation: `${column.nullable ? 'NULL' : 'NOT NULL'}${column.isPrimaryKey ? ' PRIMARY KEY' : ''}`,
              insertText: column.name,
              filterText: column.name.toLowerCase(),
              range,
              sortText: `0_${column.name}`, // Highest priority
            });
          });
          return { suggestions };
        }
      }

      // Case 2: Normal suggestions with context awareness

      // SQL Keywords (always available)
      SQL_KEYWORDS.forEach((keyword) => {
        suggestions.push({
          label: keyword,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: keyword,
          filterText: keyword.toLowerCase(),
          range,
          sortText: `2_${keyword}`,
        });
      });

      if (schema) {
        const tablesInScope = getTablesInScope(tableRefs, schema);
        const inScopeTableNames = new Set(
          tablesInScope.map((t) => t.name.toLowerCase())
        );

        // Table names
        schema.tables.forEach((table) => {
          suggestions.push({
            label: table.name,
            kind: monaco.languages.CompletionItemKind.Class,
            detail: `Table (${table.columns.length} columns)`,
            documentation: `Columns: ${table.columns.map((c) => c.name).join(', ')}`,
            insertText: table.name,
            filterText: table.name.toLowerCase(),
            range,
            sortText: `3_${table.name}`,
          });
        });

        // Column suggestions - prioritize in-scope tables (context-aware)
        schema.tables.forEach((table) => {
          const isInScope = inScopeTableNames.has(table.name.toLowerCase());
          const priority = isInScope ? '0_' : '4_'; // In-scope columns at the very top

          table.columns.forEach((column) => {
            // Unqualified column name (prioritized for in-scope tables)
            suggestions.push({
              label: column.name,
              kind: monaco.languages.CompletionItemKind.Field,
              detail: `${table.name}.${column.type}`,
              documentation: `From table: ${table.name}${isInScope ? ' (in scope)' : ''}`,
              insertText: column.name,
              filterText: column.name.toLowerCase(),
              range,
              sortText: priority + column.name,
            });

            // Qualified column name (table.column)
            const qualifiedName = `${table.name}.${column.name}`;
            suggestions.push({
              label: qualifiedName,
              kind: monaco.languages.CompletionItemKind.Field,
              detail: column.type,
              documentation: `${column.nullable ? 'NULL' : 'NOT NULL'}${column.isPrimaryKey ? ' PRIMARY KEY' : ''}`,
              insertText: qualifiedName,
              filterText: qualifiedName.toLowerCase(),
              range,
              sortText: priority + qualifiedName,
            });
          });
        });

        // View names
        schema.views.forEach((view) => {
          suggestions.push({
            label: view.name,
            kind: monaco.languages.CompletionItemKind.Interface,
            detail: 'View',
            documentation: view.sql
              ? `SQL: ${view.sql.substring(0, 100)}...`
              : undefined,
            insertText: view.name,
            filterText: view.name.toLowerCase(),
            range,
            sortText: `3_${view.name}`,
          });
        });
      }

      return { suggestions };
    },
  };
}

/**
 * Defines custom themes for Monaco Editor that match the application's light/dark theme.
 * (US2: Theme-Aware Editor, US3: SQL Syntax Highlighting)
 */
export function defineCustomThemes(monaco: typeof Monaco): void {
  // Light theme matching app colors
  monaco.editor.defineTheme('sql-pro-light', {
    base: 'vs',
    inherit: true,
    rules: [
      // SQL syntax highlighting (US3)
      { token: 'keyword', foreground: '0000FF', fontStyle: 'bold' },
      { token: 'keyword.sql', foreground: '0000FF', fontStyle: 'bold' },
      { token: 'string', foreground: 'A31515' },
      { token: 'string.sql', foreground: 'A31515' },
      { token: 'number', foreground: '098658' },
      { token: 'number.sql', foreground: '098658' },
      { token: 'comment', foreground: '008000', fontStyle: 'italic' },
      { token: 'comment.sql', foreground: '008000', fontStyle: 'italic' },
      { token: 'operator', foreground: '000000' },
      { token: 'operator.sql', foreground: '000000' },
      { token: 'identifier', foreground: '001080' },
    ],
    colors: {
      'editor.background': '#FFFFFF',
      'editor.foreground': '#000000',
      'editorLineNumber.foreground': '#6E7781',
      'editorLineNumber.activeForeground': '#000000',
      'editor.selectionBackground': '#ADD6FF',
      'editor.lineHighlightBackground': '#F5F5F5',
      'editorCursor.foreground': '#000000',
      'editor.inactiveSelectionBackground': '#E5EBF1',
      'editorSuggestWidget.background': '#FFFFFF',
      'editorSuggestWidget.border': '#E0E0E0',
      'editorSuggestWidget.selectedBackground': '#E8E8E8',
    },
  });

  // Dark theme matching app colors
  monaco.editor.defineTheme('sql-pro-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      // SQL syntax highlighting (US3)
      { token: 'keyword', foreground: '569CD6', fontStyle: 'bold' },
      { token: 'keyword.sql', foreground: '569CD6', fontStyle: 'bold' },
      { token: 'string', foreground: 'CE9178' },
      { token: 'string.sql', foreground: 'CE9178' },
      { token: 'number', foreground: 'B5CEA8' },
      { token: 'number.sql', foreground: 'B5CEA8' },
      { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
      { token: 'comment.sql', foreground: '6A9955', fontStyle: 'italic' },
      { token: 'operator', foreground: 'D4D4D4' },
      { token: 'operator.sql', foreground: 'D4D4D4' },
      { token: 'identifier', foreground: '9CDCFE' },
    ],
    colors: {
      'editor.background': '#1E1E1E',
      'editor.foreground': '#D4D4D4',
      'editorLineNumber.foreground': '#858585',
      'editorLineNumber.activeForeground': '#C6C6C6',
      'editor.selectionBackground': '#264F78',
      'editor.lineHighlightBackground': '#2A2A2A',
      'editorCursor.foreground': '#FFFFFF',
      'editor.inactiveSelectionBackground': '#3A3D41',
      'editorSuggestWidget.background': '#252526',
      'editorSuggestWidget.border': '#454545',
      'editorSuggestWidget.selectedBackground': '#04395E',
    },
  });
}
