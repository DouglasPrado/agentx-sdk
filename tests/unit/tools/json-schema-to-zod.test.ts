import { describe, it, expect } from 'vitest';
import { jsonSchemaToZod } from '../../../src/tools/json-schema-to-zod.js';

describe('jsonSchemaToZod (deep)', () => {
  it('should handle empty/undefined schema', () => {
    const schema = jsonSchemaToZod(undefined);
    expect(schema.parse({})).toEqual({});
  });

  it('should handle primitive types', () => {
    const schema = jsonSchemaToZod({
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'integer' },
        score: { type: 'number' },
        active: { type: 'boolean' },
      },
      required: ['name'],
    });

    expect(schema.parse({ name: 'John', age: 30, score: 9.5, active: true }))
      .toEqual({ name: 'John', age: 30, score: 9.5, active: true });

    // name is required
    expect(() => schema.parse({ age: 30 })).toThrow();

    // age is optional
    expect(schema.parse({ name: 'John' })).toBeDefined();
  });

  it('should handle nested objects', () => {
    const schema = jsonSchemaToZod({
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            address: {
              type: 'object',
              properties: {
                city: { type: 'string' },
                zip: { type: 'string' },
              },
            },
          },
        },
      },
    });

    const result = schema.parse({ user: { name: 'John', address: { city: 'NYC', zip: '10001' } } });
    expect(result.user.address.city).toBe('NYC');
  });

  it('should handle arrays', () => {
    const schema = jsonSchemaToZod({
      type: 'object',
      properties: {
        tags: {
          type: 'array',
          items: { type: 'string' },
        },
        scores: {
          type: 'array',
          items: { type: 'number' },
        },
      },
    });

    const result = schema.parse({ tags: ['a', 'b'], scores: [1, 2, 3] });
    expect(result.tags).toEqual(['a', 'b']);
    expect(result.scores).toEqual([1, 2, 3]);
  });

  it('should handle arrays of objects', () => {
    const schema = jsonSchemaToZod({
      type: 'object',
      properties: {
        users: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              age: { type: 'number' },
            },
          },
        },
      },
    });

    const result = schema.parse({ users: [{ name: 'A', age: 1 }, { name: 'B', age: 2 }] });
    expect(result.users).toHaveLength(2);
  });

  it('should handle enums', () => {
    const schema = jsonSchemaToZod({
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['open', 'closed', 'pending'] },
      },
    });

    expect(schema.parse({ status: 'open' })).toEqual({ status: 'open' });
    expect(() => schema.parse({ status: 'invalid' })).toThrow();
  });

  it('should handle nullable', () => {
    const schema = jsonSchemaToZod({
      type: 'object',
      properties: {
        name: { type: 'string', nullable: true },
      },
    });

    expect(schema.parse({ name: null })).toEqual({ name: null });
    expect(schema.parse({ name: 'hello' })).toEqual({ name: 'hello' });
  });

  it('should handle anyOf with primitives', () => {
    const schema = jsonSchemaToZod({
      type: 'object',
      properties: {
        value: {
          anyOf: [
            { type: 'string' },
            { type: 'number' },
          ],
        },
      },
    });

    expect(schema.parse({ value: 'hello' })).toEqual({ value: 'hello' });
    expect(schema.parse({ value: 42 })).toEqual({ value: 42 });
  });

  it('should handle descriptions', () => {
    const schema = jsonSchemaToZod({
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
    });

    // Should not throw — description is metadata
    expect(schema.parse({ query: 'test' })).toEqual({ query: 'test' });
  });

  it('should handle passthrough for unknown properties', () => {
    const schema = jsonSchemaToZod({
      type: 'object',
      properties: {
        known: { type: 'string' },
      },
    });

    // Passthrough allows unknown keys
    const result = schema.parse({ known: 'a', extra: 'b' });
    expect(result.known).toBe('a');
  });

  it('should cap recursion depth', () => {
    // Deep nesting should not stack overflow
    let current: Record<string, unknown> = { type: 'string' };
    for (let i = 0; i < 15; i++) {
      current = { type: 'object', properties: { nested: current } };
    }

    const schema = jsonSchemaToZod(current as any);
    // Should produce a valid schema (deep nesting falls back to z.unknown)
    expect(schema).toBeDefined();
  });
});
