import { z } from 'zod';
import type { AgentTool } from '../../contracts/entities/agent-tool.js';
import type { SqlQueryDef } from './sql-query-def.js';

/** Unwrap Zod wrappers (nullable, optional, default) to get the base type name. */
function unwrapZodType(schema: z.ZodTypeAny): string {
  if (schema instanceof z.ZodNullable || schema instanceof z.ZodOptional) {
    return unwrapZodType((schema as z.ZodNullable<z.ZodTypeAny> | z.ZodOptional<z.ZodTypeAny>).unwrap());
  }
  if (schema instanceof z.ZodDefault) {
    return unwrapZodType(schema.removeDefault());
  }
  if (schema instanceof z.ZodString) return 'string';
  if (schema instanceof z.ZodNumber) return 'number';
  if (schema instanceof z.ZodBoolean) return 'boolean';
  if (schema instanceof z.ZodEnum) return 'enum';
  return 'unknown';
}

/** Minimal interface for a Postgres-compatible query runner (e.g. pg.Pool). */
export interface SqlQueryRunner {
  query(sql: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export interface SqlToolFactoryOptions {
  /** Connection pool or client that implements `query()`. */
  pool: SqlQueryRunner;

  /** Catalog of query definitions. */
  queries: SqlQueryDef[];

  /** Max characters for query results before truncation. Default: 8000. */
  maxResultChars?: number;

  /** Default per-query timeout in ms. Default: 30 000. */
  defaultTimeoutMs?: number;

  /** Prefix for tool names. Default: '' (empty). */
  toolNamePrefix?: string;
}

/**
 * Creates two meta-tools (`search_queries` + `run_query`) from a catalog of SQL queries.
 *
 * This keeps the LLM context small (2 tool definitions instead of N) while still
 * giving the agent access to all queries via a search→execute workflow.
 */
export function createSqlTools(options: SqlToolFactoryOptions): AgentTool[] {
  const {
    pool,
    queries,
    maxResultChars = 8_000,
    defaultTimeoutMs = 30_000,
    toolNamePrefix = '',
  } = options;

  const queryMap = new Map<string, SqlQueryDef>();
  for (const q of queries) {
    queryMap.set(q.name, q);
  }

  const searchTool: AgentTool = {
    name: `${toolNamePrefix}search_queries`,
    description:
      'Search available SQL queries by keyword. Returns matching query names, descriptions, and parameter info. Use this before run_query to find the right query.',
    parameters: z.object({
      keyword: z
        .string()
        .describe('Search term to match against query names, descriptions, and tags'),
    }),
    isConcurrencySafe: true,
    isReadOnly: true,
    maxResultChars,

    async execute(rawArgs: unknown) {
      const { keyword } = rawArgs as { keyword: string };
      const lower = keyword.toLowerCase();

      const matches = queries.filter((q) => {
        const haystack = `${q.name} ${q.description} ${(q.tags ?? []).join(' ')}`.toLowerCase();
        return lower.split(/\s+/).every((term) => haystack.includes(term));
      });

      if (matches.length === 0) {
        return `No queries found matching "${keyword}". Try a broader term.`;
      }

      const results = matches.map((q) => {
        const shape = (q.parameters as z.ZodObject<z.ZodRawShape>).shape;
        const params: Record<string, { type: string; nullable: boolean; description: string }> = {};
        for (const [key, schema] of Object.entries(shape)) {
          const s = schema as z.ZodTypeAny;
          params[key] = {
            type: unwrapZodType(s),
            nullable: s.isNullable(),
            description: s.description ?? '',
          };
        }
        return {
          name: q.name,
          description: q.description,
          parameters: params,
          tags: q.tags ?? [],
        };
      });

      return JSON.stringify(results, null, 2);
    },
  };

  // Build inline catalog for run_query description so the LLM knows all queries upfront
  const catalog = queries.map((q) => {
    const shape = (q.parameters as z.ZodObject<z.ZodRawShape>).shape;
    const paramList = Object.entries(shape)
      .map(([key, schema]) => {
        const s = schema as z.ZodTypeAny;
        const nullable = s.isNullable() ? ', nullable' : '';
        return `${key} (${unwrapZodType(s)}${nullable}): ${s.description ?? ''}`;
      })
      .join('; ');
    return `- ${q.name}: ${q.description} Params: { ${paramList} }`;
  }).join('\n');

  const runTool: AgentTool = {
    name: `${toolNamePrefix}run_query`,
    description:
      `Execute a SQL query by name. Pass params as key-value pairs. Use null for optional/nullable params you don't need.\n\nAvailable queries:\n${catalog}`,
    parameters: z.object({
      query_name: z.string().describe('Name of the query to execute'),
      params: z
        .record(z.unknown())
        .describe('Parameters as key-value pairs. Use null for nullable params you want to skip'),
    }),
    isConcurrencySafe: true,
    isReadOnly: true,
    maxResultChars,
    timeoutMs: defaultTimeoutMs,

    async execute(rawArgs: unknown) {
      const { query_name, params } = rawArgs as {
        query_name: string;
        params: Record<string, unknown>;
      };

      const def = queryMap.get(query_name);
      if (!def) {
        return {
          content: `Query "${query_name}" not found. Use search_queries to find available queries.`,
          isError: true,
        };
      }

      // Validate params against the query's Zod schema
      const parsed = def.parameters.safeParse(params);
      if (!parsed.success) {
        const errors = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
        return {
          content: `Invalid parameters:\n${errors.join('\n')}`,
          isError: true,
        };
      }

      // Map values in schema key order to match $1, $2, ... in SQL
      const schemaKeys = Object.keys((def.parameters as z.ZodObject<z.ZodRawShape>).shape);
      const data = parsed.data as Record<string, unknown>;
      const values = schemaKeys.map((key) => data[key] ?? null);

      try {
        const result = await pool.query(def.sql, values);

        if (result.rows.length === 0) {
          return 'Query returned 0 rows.';
        }

        return JSON.stringify(result.rows, null, 2);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: `Query execution failed: ${message}`, isError: true };
      }
    },
  };

  return [searchTool, runTool];
}
