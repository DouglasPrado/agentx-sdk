import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { createSqlTools } from '../../../src/tools/sql/sql-tool-factory.js';
import type { SqlQueryDef } from '../../../src/tools/sql/sql-query-def.js';
import type { SqlQueryRunner } from '../../../src/tools/sql/sql-tool-factory.js';

function makePool(rows: Record<string, unknown>[] = []): SqlQueryRunner {
  return { query: vi.fn().mockResolvedValue({ rows }) };
}

const sampleQueries: SqlQueryDef[] = [
  {
    name: 'sales_revenue_by_month',
    description: 'Monthly revenue for a given product',
    sql: `SELECT date_trunc('month', created_at) as month, SUM(total) as revenue FROM orders WHERE product_id = $1 GROUP BY 1`,
    parameters: z.object({
      product_id: z.number().describe('Product ID'),
    }),
    tags: ['sales', 'finance'],
  },
  {
    name: 'inventory_low_stock',
    description: 'Products with stock below threshold',
    sql: 'SELECT * FROM products WHERE stock < $1 ORDER BY stock ASC',
    parameters: z.object({
      threshold: z.number().describe('Stock threshold'),
    }),
    tags: ['inventory'],
  },
  {
    name: 'customers_by_region',
    description: 'List customers in a specific region',
    sql: 'SELECT * FROM customers WHERE region = $1 LIMIT $2',
    parameters: z.object({
      region: z.string().describe('Region name'),
      limit: z.number().describe('Max results'),
    }),
    tags: ['customers'],
  },
];

describe('createSqlTools', () => {
  it('returns exactly two tools: search_queries and run_query', () => {
    const tools = createSqlTools({ pool: makePool(), queries: sampleQueries });
    expect(tools).toHaveLength(2);
    expect(tools[0]!.name).toBe('search_queries');
    expect(tools[1]!.name).toBe('run_query');
  });

  it('respects toolNamePrefix', () => {
    const tools = createSqlTools({ pool: makePool(), queries: sampleQueries, toolNamePrefix: 'pg_' });
    expect(tools[0]!.name).toBe('pg_search_queries');
    expect(tools[1]!.name).toBe('pg_run_query');
  });

  describe('search_queries', () => {
    it('finds queries by keyword in name', async () => {
      const [search] = createSqlTools({ pool: makePool(), queries: sampleQueries });
      const result = await search!.execute({ keyword: 'revenue' }, AbortSignal.timeout(5000));
      const parsed = JSON.parse(result as string);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].name).toBe('sales_revenue_by_month');
    });

    it('finds queries by tag', async () => {
      const [search] = createSqlTools({ pool: makePool(), queries: sampleQueries });
      const result = await search!.execute({ keyword: 'inventory' }, AbortSignal.timeout(5000));
      const parsed = JSON.parse(result as string);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].name).toBe('inventory_low_stock');
    });

    it('finds queries matching multiple terms (AND logic)', async () => {
      const [search] = createSqlTools({ pool: makePool(), queries: sampleQueries });
      const result = await search!.execute({ keyword: 'sales finance' }, AbortSignal.timeout(5000));
      const parsed = JSON.parse(result as string);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].name).toBe('sales_revenue_by_month');
    });

    it('returns message when no matches found', async () => {
      const [search] = createSqlTools({ pool: makePool(), queries: sampleQueries });
      const result = await search!.execute({ keyword: 'nonexistent' }, AbortSignal.timeout(5000));
      expect(result).toContain('No queries found');
    });

    it('includes parameter details in results', async () => {
      const [search] = createSqlTools({ pool: makePool(), queries: sampleQueries });
      const result = await search!.execute({ keyword: 'customers' }, AbortSignal.timeout(5000));
      const parsed = JSON.parse(result as string);
      expect(parsed[0].parameters).toEqual({
        region: { type: 'string', nullable: false, description: 'Region name' },
        limit: { type: 'number', nullable: false, description: 'Max results' },
      });
    });
  });

  describe('run_query', () => {
    it('executes query with validated params', async () => {
      const pool = makePool([{ month: '2024-01', revenue: 5000 }]);
      const [, run] = createSqlTools({ pool, queries: sampleQueries });

      const result = await run!.execute(
        { query_name: 'sales_revenue_by_month', params: { product_id: 42 } },
        AbortSignal.timeout(5000),
      );

      expect(pool.query).toHaveBeenCalledWith(sampleQueries[0]!.sql, [42]);
      const parsed = JSON.parse(result as string);
      expect(parsed).toEqual([{ month: '2024-01', revenue: 5000 }]);
    });

    it('passes multiple params in schema key order', async () => {
      const pool = makePool([{ id: 1, name: 'Acme' }]);
      const [, run] = createSqlTools({ pool, queries: sampleQueries });

      await run!.execute(
        { query_name: 'customers_by_region', params: { region: 'South', limit: 10 } },
        AbortSignal.timeout(5000),
      );

      expect(pool.query).toHaveBeenCalledWith(sampleQueries[2]!.sql, ['South', 10]);
    });

    it('returns error for unknown query name', async () => {
      const [, run] = createSqlTools({ pool: makePool(), queries: sampleQueries });
      const result = await run!.execute(
        { query_name: 'nonexistent', params: {} },
        AbortSignal.timeout(5000),
      );
      expect(result).toEqual(
        expect.objectContaining({ isError: true, content: expect.stringContaining('not found') }),
      );
    });

    it('returns validation error for invalid params', async () => {
      const [, run] = createSqlTools({ pool: makePool(), queries: sampleQueries });
      const result = await run!.execute(
        { query_name: 'sales_revenue_by_month', params: { product_id: 'not-a-number' } },
        AbortSignal.timeout(5000),
      );
      expect(result).toEqual(
        expect.objectContaining({ isError: true, content: expect.stringContaining('Invalid parameters') }),
      );
    });

    it('returns message for empty result set', async () => {
      const [, run] = createSqlTools({ pool: makePool([]), queries: sampleQueries });
      const result = await run!.execute(
        { query_name: 'sales_revenue_by_month', params: { product_id: 999 } },
        AbortSignal.timeout(5000),
      );
      expect(result).toBe('Query returned 0 rows.');
    });

    it('returns error when query execution fails', async () => {
      const pool: SqlQueryRunner = {
        query: vi.fn().mockRejectedValue(new Error('connection refused')),
      };
      const [, run] = createSqlTools({ pool, queries: sampleQueries });
      const result = await run!.execute(
        { query_name: 'sales_revenue_by_month', params: { product_id: 1 } },
        AbortSignal.timeout(5000),
      );
      expect(result).toEqual(
        expect.objectContaining({ isError: true, content: expect.stringContaining('connection refused') }),
      );
    });
  });
});
