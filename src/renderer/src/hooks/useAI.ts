import type { DataInsight, SchemaInfo } from '../../../shared/types';
import { useCallback, useState } from 'react';
import { useAIStore } from '@/stores/ai-store';

// System prompts for different AI features
const SYSTEM_PROMPTS = {
  nlToSql: `You are an expert SQL query generator for SQLite databases. Your task is to convert natural language questions into valid SQLite queries.

Rules:
1. Only output valid SQLite syntax
2. Use the provided schema to reference correct table and column names
3. Use proper quoting for identifiers when needed
4. Prefer explicit column names over SELECT *
5. Include appropriate WHERE clauses, JOINs, and ORDER BY as needed
6. For aggregations, always include GROUP BY when using aggregate functions
7. Output ONLY the SQL query, no explanations

Schema information will be provided in the user message.`,

  queryOptimize: `You are an expert SQLite query optimizer. Analyze the provided query and suggest optimizations.

Rules:
1. Focus on performance improvements
2. Suggest index creation when beneficial
3. Recommend query rewrites for better efficiency
4. Consider SQLite-specific optimizations
5. Output a JSON object with:
   - optimizedQuery: the improved query (or original if no changes needed)
   - suggestions: array of optimization suggestions
   - explanation: brief explanation of changes

Schema and query plan information will be provided.`,

  dataAnalysis: `You are a data analyst expert. Analyze the provided data and identify patterns, anomalies, and insights.

Rules:
1. Look for outliers and unusual values
2. Identify data quality issues (nulls, duplicates, format inconsistencies)
3. Suggest data improvements
4. Output a JSON object with:
   - insights: array of { type, column, message, severity, details }
   - summary: brief overall analysis

Types: 'anomaly', 'suggestion', 'pattern'
Severity: 'info', 'warning', 'error'`,
};

// Format schema for AI context
function formatSchemaForAI(schema: SchemaInfo[]): string {
  return schema
    .map((s) => {
      const tables = [...s.tables, ...s.views]
        .map((t) => {
          const cols = t.columns
            .map(
              (c) =>
                `  ${c.name} ${c.type}${c.isPrimaryKey ? ' PRIMARY KEY' : ''}${!c.nullable ? ' NOT NULL' : ''}`
            )
            .join('\n');
          const fks = t.foreignKeys
            .map(
              (fk) =>
                `  FOREIGN KEY (${fk.column}) REFERENCES ${fk.referencedTable}(${fk.referencedColumn})`
            )
            .join('\n');
          return `${t.type.toUpperCase()} ${t.name}:\n${cols}${fks ? `\n${fks}` : ''}`;
        })
        .join('\n\n');
      return `Schema: ${s.name}\n${tables}`;
    })
    .join('\n\n');
}

interface UseNLToSQLOptions {
  schema: SchemaInfo[];
  onSuccess?: (sql: string) => void;
  onError?: (error: string) => void;
}

export function useNLToSQL({ schema, onSuccess, onError }: UseNLToSQLOptions) {
  const { apiKey, provider, model, isConfigured } = useAIStore();
  const [generatedSQL, setGeneratedSQL] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSQL = useCallback(
    async (prompt: string) => {
      if (!isConfigured) {
        const err =
          'AI is not configured. Please set up your API key in settings.';
        setError(err);
        onError?.(err);
        return null;
      }

      setIsGenerating(true);
      setError(null);
      setGeneratedSQL('');

      try {
        const schemaContext = formatSchemaForAI(schema);

        // Use fetch directly for streaming since we're in Electron
        const response = await fetch(
          provider === 'openai'
            ? 'https://api.openai.com/v1/chat/completions'
            : 'https://api.anthropic.com/v1/messages',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(provider === 'openai'
                ? { Authorization: `Bearer ${apiKey}` }
                : {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true',
                  }),
            },
            body: JSON.stringify(
              provider === 'openai'
                ? {
                    model,
                    messages: [
                      { role: 'system', content: SYSTEM_PROMPTS.nlToSql },
                      {
                        role: 'user',
                        content: `Database Schema:\n${schemaContext}\n\nUser Request: ${prompt}`,
                      },
                    ],
                    stream: false,
                  }
                : {
                    model,
                    max_tokens: 1024,
                    system: SYSTEM_PROMPTS.nlToSql,
                    messages: [
                      {
                        role: 'user',
                        content: `Database Schema:\n${schemaContext}\n\nUser Request: ${prompt}`,
                      },
                    ],
                  }
            ),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error?.message || `API error: ${response.status}`
          );
        }

        const data = await response.json();
        const sql =
          provider === 'openai'
            ? data.choices?.[0]?.message?.content?.trim()
            : data.content?.[0]?.text?.trim();

        if (sql) {
          // Clean up the SQL (remove markdown code blocks if present)
          const cleanSQL = sql
            .replace(/^```sql\n?/i, '')
            .replace(/^```\n?/, '')
            .replace(/\n?```$/, '')
            .trim();
          setGeneratedSQL(cleanSQL);
          onSuccess?.(cleanSQL);
          return cleanSQL;
        }

        throw new Error('No SQL generated');
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : 'Failed to generate SQL';
        setError(errorMsg);
        onError?.(errorMsg);
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    [apiKey, provider, model, schema, isConfigured, onSuccess, onError]
  );

  return {
    generateSQL,
    generatedSQL,
    isGenerating,
    error,
    isConfigured,
  };
}

interface UseQueryOptimizerOptions {
  schema: SchemaInfo[];
  onSuccess?: (result: {
    optimizedQuery: string;
    suggestions: string[];
    explanation: string;
  }) => void;
  onError?: (error: string) => void;
}

export function useQueryOptimizer({
  schema,
  onSuccess,
  onError,
}: UseQueryOptimizerOptions) {
  const { apiKey, provider, model, isConfigured } = useAIStore();
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    optimizedQuery: string;
    suggestions: string[];
    explanation: string;
  } | null>(null);

  const optimizeQuery = useCallback(
    async (query: string, queryPlan?: string) => {
      if (!isConfigured) {
        const err =
          'AI is not configured. Please set up your API key in settings.';
        setError(err);
        onError?.(err);
        return null;
      }

      setIsOptimizing(true);
      setError(null);
      setResult(null);

      try {
        const schemaContext = formatSchemaForAI(schema);
        const planContext = queryPlan ? `\n\nQuery Plan:\n${queryPlan}` : '';

        const response = await fetch(
          provider === 'openai'
            ? 'https://api.openai.com/v1/chat/completions'
            : 'https://api.anthropic.com/v1/messages',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(provider === 'openai'
                ? { Authorization: `Bearer ${apiKey}` }
                : {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true',
                  }),
            },
            body: JSON.stringify(
              provider === 'openai'
                ? {
                    model,
                    messages: [
                      { role: 'system', content: SYSTEM_PROMPTS.queryOptimize },
                      {
                        role: 'user',
                        content: `Database Schema:\n${schemaContext}${planContext}\n\nQuery to optimize:\n${query}`,
                      },
                    ],
                    response_format: { type: 'json_object' },
                  }
                : {
                    model,
                    max_tokens: 2048,
                    system: SYSTEM_PROMPTS.queryOptimize,
                    messages: [
                      {
                        role: 'user',
                        content: `Database Schema:\n${schemaContext}${planContext}\n\nQuery to optimize:\n${query}\n\nRespond with a JSON object.`,
                      },
                    ],
                  }
            ),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error?.message || `API error: ${response.status}`
          );
        }

        const data = await response.json();
        const content =
          provider === 'openai'
            ? data.choices?.[0]?.message?.content
            : data.content?.[0]?.text;

        if (content) {
          const parsed = JSON.parse(content);
          const optimizationResult = {
            optimizedQuery: parsed.optimizedQuery || query,
            suggestions: parsed.suggestions || [],
            explanation: parsed.explanation || '',
          };
          setResult(optimizationResult);
          onSuccess?.(optimizationResult);
          return optimizationResult;
        }

        throw new Error('No optimization result');
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : 'Failed to optimize query';
        setError(errorMsg);
        onError?.(errorMsg);
        return null;
      } finally {
        setIsOptimizing(false);
      }
    },
    [apiKey, provider, model, schema, isConfigured, onSuccess, onError]
  );

  return {
    optimizeQuery,
    result,
    isOptimizing,
    error,
    isConfigured,
  };
}

interface UseDataAnalysisOptions {
  onSuccess?: (insights: DataInsight[], summary: string) => void;
  onError?: (error: string) => void;
}

export function useDataAnalysis({
  onSuccess,
  onError,
}: UseDataAnalysisOptions = {}) {
  const { apiKey, provider, model, isConfigured } = useAIStore();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<DataInsight[]>([]);
  const [summary, setSummary] = useState<string>('');

  const analyzeData = useCallback(
    async (
      columns: { name: string; type: string }[],
      rows: Record<string, unknown>[]
    ) => {
      if (!isConfigured) {
        const err =
          'AI is not configured. Please set up your API key in settings.';
        setError(err);
        onError?.(err);
        return null;
      }

      // Limit data for analysis (first 100 rows, sample for larger datasets)
      const sampleRows = rows.length > 100 ? rows.slice(0, 100) : rows;

      setIsAnalyzing(true);
      setError(null);
      setInsights([]);
      setSummary('');

      try {
        const dataContext = `Columns: ${columns.map((c) => `${c.name} (${c.type})`).join(', ')}\n\nSample Data (${sampleRows.length} of ${rows.length} rows):\n${JSON.stringify(sampleRows.slice(0, 20), null, 2)}`;

        const response = await fetch(
          provider === 'openai'
            ? 'https://api.openai.com/v1/chat/completions'
            : 'https://api.anthropic.com/v1/messages',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(provider === 'openai'
                ? { Authorization: `Bearer ${apiKey}` }
                : {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true',
                  }),
            },
            body: JSON.stringify(
              provider === 'openai'
                ? {
                    model,
                    messages: [
                      { role: 'system', content: SYSTEM_PROMPTS.dataAnalysis },
                      { role: 'user', content: dataContext },
                    ],
                    response_format: { type: 'json_object' },
                  }
                : {
                    model,
                    max_tokens: 2048,
                    system: SYSTEM_PROMPTS.dataAnalysis,
                    messages: [
                      {
                        role: 'user',
                        content: `${dataContext}\n\nRespond with a JSON object.`,
                      },
                    ],
                  }
            ),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error?.message || `API error: ${response.status}`
          );
        }

        const data = await response.json();
        const content =
          provider === 'openai'
            ? data.choices?.[0]?.message?.content
            : data.content?.[0]?.text;

        if (content) {
          const parsed = JSON.parse(content);
          const analysisInsights: DataInsight[] = parsed.insights || [];
          const analysisSummary: string = parsed.summary || '';

          setInsights(analysisInsights);
          setSummary(analysisSummary);
          onSuccess?.(analysisInsights, analysisSummary);
          return { insights: analysisInsights, summary: analysisSummary };
        }

        throw new Error('No analysis result');
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : 'Failed to analyze data';
        setError(errorMsg);
        onError?.(errorMsg);
        return null;
      } finally {
        setIsAnalyzing(false);
      }
    },
    [apiKey, provider, model, isConfigured, onSuccess, onError]
  );

  return {
    analyzeData,
    insights,
    summary,
    isAnalyzing,
    error,
    isConfigured,
  };
}
