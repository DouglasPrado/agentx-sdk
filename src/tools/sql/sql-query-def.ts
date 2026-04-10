import type { ZodObject, ZodRawShape } from 'zod';

/**
 * Declarative definition of a SQL query exposed as an agent tool.
 *
 * Each definition maps to a named, searchable query that the LLM can
 * discover via `search_queries` and execute via `run_query`.
 */
export interface SqlQueryDef {
  /** Unique identifier — use domain-prefixed snake_case (e.g. sales_revenue_by_month). */
  name: string;

  /** Human-readable description — the LLM uses this to decide which query to pick. */
  description: string;

  /** Parametrized SQL ($1, $2, …). Parameter order must match the Zod schema key order. */
  sql: string;

  /** Zod schema for query parameters. Key order determines $1, $2, … mapping. */
  parameters: ZodObject<ZodRawShape>;

  /** Tags for search filtering (e.g. ['sales', 'finance']). */
  tags?: string[];

  /** Per-query timeout in milliseconds. Default: 30 000. */
  timeoutMs?: number;
}
