/**
 * Deep JSON Schema → Zod converter.
 *
 * Converts JSON Schema objects (as returned by MCP servers) to Zod schemas
 * for validation in the ToolExecutor pipeline.
 *
 * Supports: primitives, nested objects, arrays, enums, anyOf/oneOf,
 * nullable, descriptions, required fields. Max recursion depth: 10.
 */

import { z } from 'zod';

const MAX_DEPTH = 10;

type JsonSchema = {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  nullable?: boolean;
  description?: string;
  default?: unknown;
  [key: string]: unknown;
};

/**
 * Convert a JSON Schema to a Zod schema.
 * Returns `z.object({}).passthrough()` for undefined/empty input.
 */
export function jsonSchemaToZod(schema?: JsonSchema | null, depth = 0): z.ZodTypeAny {
  if (!schema || depth > MAX_DEPTH) return z.unknown();

  // Handle anyOf / oneOf → z.union
  if (schema.anyOf && schema.anyOf.length > 0) {
    return buildUnion(schema.anyOf, depth);
  }
  if (schema.oneOf && schema.oneOf.length > 0) {
    return buildUnion(schema.oneOf, depth);
  }

  // Handle enum
  if (schema.enum && schema.enum.length > 0) {
    return buildEnum(schema.enum, schema.nullable);
  }

  const type = schema.type;

  // Object with properties
  if (type === 'object' || (schema.properties && !type)) {
    return buildObject(schema, depth);
  }

  // Array
  if (type === 'array') {
    const items = schema.items
      ? jsonSchemaToZod(schema.items, depth + 1)
      : z.unknown();
    let arr: z.ZodTypeAny = z.array(items);
    if (schema.nullable) arr = arr.nullable();
    if (schema.description) arr = arr.describe(schema.description);
    return arr;
  }

  // Primitives
  let field: z.ZodTypeAny;
  switch (type) {
    case 'string':
      field = z.string();
      break;
    case 'number':
    case 'integer':
      field = z.number();
      break;
    case 'boolean':
      field = z.boolean();
      break;
    case 'null':
      field = z.null();
      break;
    default:
      field = z.unknown();
      break;
  }

  if (schema.nullable) field = field.nullable();
  if (schema.description) field = field.describe(schema.description);

  return field;
}

function buildObject(schema: JsonSchema, depth: number): z.ZodTypeAny {
  if (!schema.properties) return z.object({}).passthrough();

  const required = new Set(schema.required ?? []);
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, propSchema] of Object.entries(schema.properties)) {
    let field = jsonSchemaToZod(propSchema, depth + 1);
    if (!required.has(key)) {
      field = field.optional();
    }
    shape[key] = field;
  }

  let obj: z.ZodTypeAny = z.object(shape).passthrough();
  if (schema.nullable) obj = obj.nullable();
  if (schema.description) obj = obj.describe(schema.description);
  return obj;
}

function buildEnum(values: unknown[], nullable?: boolean): z.ZodTypeAny {
  // Filter to string values for z.enum (Zod enums only support strings)
  const strings = values.filter((v): v is string => typeof v === 'string');
  if (strings.length >= 2) {
    let e: z.ZodTypeAny = z.enum(strings as [string, ...string[]]);
    if (nullable) e = e.nullable();
    return e;
  }
  if (strings.length === 1) {
    let e: z.ZodTypeAny = z.literal(strings[0]!);
    if (nullable) e = e.nullable();
    return e;
  }
  // Mixed types — fall back to union of literals
  const literals = values.map(v => z.literal(v as z.Primitive));
  if (literals.length >= 2) {
    return z.union(literals as unknown as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
  }
  return z.unknown();
}

function buildUnion(schemas: JsonSchema[], depth: number): z.ZodTypeAny {
  const members = schemas.map(s => jsonSchemaToZod(s, depth + 1));
  if (members.length >= 2) {
    return z.union(members as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
  }
  if (members.length === 1) return members[0]!;
  return z.unknown();
}
