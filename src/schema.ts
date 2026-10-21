import type { DiagnosticCode, DiagnosticLevel, TestRecord, TestState } from 'test-inventory';
import inventorySchema from 'test-inventory/schema/v1.json' with { type: 'json' };

export type JsonSchema = Record<string, unknown>;

const definitions = inventorySchema.definitions as Record<string, JsonSchema>;

/** The values an enum of test-inventory has now; its schema also accepts values added in later releases. */
function knownValues<T extends string>(name: string): [T, ...T[]] {
  const schema = definitions[name];
  const closed = (schema.anyOf as JsonSchema[] | undefined)?.[0] ?? schema;
  return closed.enum as [T, ...T[]];
}

export const TEST_STATES = knownValues<TestState>('TestState');
export const DIAGNOSTIC_LEVELS = knownValues<DiagnosticLevel>('DiagnosticLevel');
export const DIAGNOSTIC_CODES = knownValues<DiagnosticCode>('DiagnosticCode');
export const TEST_KEYS = Object.keys(definitions.TestRecord.properties as JsonSchema) as [
  keyof TestRecord,
  ...(keyof TestRecord)[],
];

export function ref(name: string): JsonSchema {
  return { $ref: `#/definitions/${name}` };
}

/** A test record with `id` and any of its other keys, as `fields` picks them. */
export const pickedTest: JsonSchema = { ...definitions.TestRecord, required: ['id'] };

function collectRefs(value: unknown, found: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectRefs(item, found);
  } else if (typeof value === 'object' && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      if (key === '$ref') {
        const name = (item as string).replace('#/definitions/', '');
        if (!found.has(name)) {
          found.add(name);
          collectRefs(definitions[name], found);
        }
      } else {
        collectRefs(item, found);
      }
    }
  }
}

/**
 * The output schema of a tool: an object whose keys are all present, with the definitions of test-inventory's schema
 * that its `$ref`s use, so a record is described exactly as test-inventory writes it.
 */
export function outputSchema(properties: Record<string, JsonSchema>): JsonSchema {
  const used = new Set<string>();
  collectRefs(properties, used);
  return {
    $schema: inventorySchema.$schema,
    type: 'object',
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
    definitions: Object.fromEntries([...used].sort().map((name) => [name, definitions[name]])),
  };
}
