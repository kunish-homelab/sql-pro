import type { DataInsight, SchemaInfo } from '../../../shared/types';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { useCallback, useState } from 'react';
import { useAIStore } from '@/stores/ai-store';

// Access the IPC API exposed by preload
const sqlProAPI = window.sqlPro;

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

// Create OpenAI client (only for official API)
function createOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true,
  });
}

// Create Anthropic client (only for official API)
function createAnthropicClient(apiKey: string): Anthropic {
  return new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });
}

// Fetch-based API call for custom endpoints via IPC (bypasses CORS)
async function fetchOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  options?: { response_format?: { type: string } }
): Promise<string | null> {
  const response = await sqlProAPI.ai.fetchOpenAI({
    baseUrl,
    apiKey,
    model,
    messages,
    responseFormat: options?.response_format,
  });

  if (!response.success) {
    throw new Error(response.error || 'API error');
  }

  return response.content || null;
}

async function fetchAnthropicCompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  system: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number = 1024
): Promise<string | null> {
  const response = await sqlProAPI.ai.fetchAnthropic({
    baseUrl,
    apiKey,
    model,
    system,
    messages,
    maxTokens,
  });

  if (!response.success) {
    throw new Error(response.error || 'API error');
  }

  return response.content || null;
}

interface UseNLToSQLOptions {
  schema: SchemaInfo[];
  onSuccess?: (sql: string) => void;
  onError?: (error: string) => void;
}

export function useNLToSQL({ schema, onSuccess, onError }: UseNLToSQLOptions) {
  const { apiKey, provider, model, baseUrl, isConfigured } = useAIStore();
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
        const userContent = `Database Schema:\n${schemaContext}\n\nUser Request: ${prompt}`;

        let sql: string | null = null;

        // Use fetch for custom endpoints to avoid SDK's extra headers causing CORS issues
        // Use SDK for official APIs for better type safety and features
        if (provider === 'openai') {
          if (baseUrl) {
            sql = await fetchOpenAICompatible(baseUrl, apiKey, model, [
              { role: 'system', content: SYSTEM_PROMPTS.nlToSql },
              { role: 'user', content: userContent },
            ]);
          } else {
            const client = createOpenAIClient(apiKey);
            const response = await client.chat.completions.create({
              model,
              messages: [
                { role: 'system', content: SYSTEM_PROMPTS.nlToSql },
                { role: 'user', content: userContent },
              ],
            });
            sql = response.choices[0]?.message?.content?.trim() || null;
          }
        } else {
          if (baseUrl) {
            sql = await fetchAnthropicCompatible(
              baseUrl,
              apiKey,
              model,
              SYSTEM_PROMPTS.nlToSql,
              [{ role: 'user', content: userContent }],
              1024
            );
          } else {
            const client = createAnthropicClient(apiKey);
            const response = await client.messages.create({
              model,
              max_tokens: 1024,
              system: SYSTEM_PROMPTS.nlToSql,
              messages: [{ role: 'user', content: userContent }],
            });
            const textBlock = response.content.find(
              (block) => block.type === 'text'
            );
            sql =
              textBlock && 'text' in textBlock ? textBlock.text.trim() : null;
          }
        }

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
    [apiKey, provider, model, baseUrl, schema, isConfigured, onSuccess, onError]
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
  const { apiKey, provider, model, baseUrl, isConfigured } = useAIStore();
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
        const userContent = `Database Schema:\n${schemaContext}${planContext}\n\nQuery to optimize:\n${query}`;

        let content: string | null = null;

        // Use fetch for custom endpoints to avoid SDK's extra headers causing CORS issues
        // Use SDK for official APIs for better type safety and features
        if (provider === 'openai') {
          if (baseUrl) {
            content = await fetchOpenAICompatible(
              baseUrl,
              apiKey,
              model,
              [
                { role: 'system', content: SYSTEM_PROMPTS.queryOptimize },
                { role: 'user', content: userContent },
              ],
              { response_format: { type: 'json_object' } }
            );
          } else {
            const client = createOpenAIClient(apiKey);
            const response = await client.chat.completions.create({
              model,
              messages: [
                { role: 'system', content: SYSTEM_PROMPTS.queryOptimize },
                { role: 'user', content: userContent },
              ],
              response_format: { type: 'json_object' },
            });
            content = response.choices[0]?.message?.content || null;
          }
        } else {
          if (baseUrl) {
            content = await fetchAnthropicCompatible(
              baseUrl,
              apiKey,
              model,
              SYSTEM_PROMPTS.queryOptimize,
              [
                {
                  role: 'user',
                  content: `${userContent}\n\nRespond with a JSON object.`,
                },
              ],
              2048
            );
          } else {
            const client = createAnthropicClient(apiKey);
            const response = await client.messages.create({
              model,
              max_tokens: 2048,
              system: SYSTEM_PROMPTS.queryOptimize,
              messages: [
                {
                  role: 'user',
                  content: `${userContent}\n\nRespond with a JSON object.`,
                },
              ],
            });
            const textBlock = response.content.find(
              (block) => block.type === 'text'
            );
            content =
              textBlock && 'text' in textBlock ? textBlock.text.trim() : null;
          }
        }

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
    [apiKey, provider, model, baseUrl, schema, isConfigured, onSuccess, onError]
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
  const { apiKey, provider, model, baseUrl, isConfigured } = useAIStore();
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

        let content: string | null = null;

        // Use fetch for custom endpoints to avoid SDK's extra headers causing CORS issues
        // Use SDK for official APIs for better type safety and features
        if (provider === 'openai') {
          if (baseUrl) {
            content = await fetchOpenAICompatible(
              baseUrl,
              apiKey,
              model,
              [
                { role: 'system', content: SYSTEM_PROMPTS.dataAnalysis },
                { role: 'user', content: dataContext },
              ],
              { response_format: { type: 'json_object' } }
            );
          } else {
            const client = createOpenAIClient(apiKey);
            const response = await client.chat.completions.create({
              model,
              messages: [
                { role: 'system', content: SYSTEM_PROMPTS.dataAnalysis },
                { role: 'user', content: dataContext },
              ],
              response_format: { type: 'json_object' },
            });
            content = response.choices[0]?.message?.content || null;
          }
        } else {
          if (baseUrl) {
            content = await fetchAnthropicCompatible(
              baseUrl,
              apiKey,
              model,
              SYSTEM_PROMPTS.dataAnalysis,
              [
                {
                  role: 'user',
                  content: `${dataContext}\n\nRespond with a JSON object.`,
                },
              ],
              2048
            );
          } else {
            const client = createAnthropicClient(apiKey);
            const response = await client.messages.create({
              model,
              max_tokens: 2048,
              system: SYSTEM_PROMPTS.dataAnalysis,
              messages: [
                {
                  role: 'user',
                  content: `${dataContext}\n\nRespond with a JSON object.`,
                },
              ],
            });
            const textBlock = response.content.find(
              (block) => block.type === 'text'
            );
            content =
              textBlock && 'text' in textBlock ? textBlock.text.trim() : null;
          }
        }

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
    [apiKey, provider, model, baseUrl, isConfigured, onSuccess, onError]
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
