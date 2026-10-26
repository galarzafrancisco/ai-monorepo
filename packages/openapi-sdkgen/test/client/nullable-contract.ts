/**
 * Contract check: nullable properties must keep `| null` in the generated
 * types, including named enums and refs (emitted by Nest as
 * `{ nullable: true, allOf: [{ $ref }] }`). The test client tsconfig is not
 * strict, so this asserts on the generated source rather than via tsc.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const typesPath = fileURLToPath(new URL('./generated/types.ts', import.meta.url));
const source = readFileSync(typesPath, 'utf8');

const match = source.match(/export interface NullableEnumsDto \{([\s\S]*?)\n\}/);
if (!match) {
  console.error('❌ NullableEnumsDto not found in generated types');
  process.exit(1);
}
const body = match[1];

const expected = [
  'namedEnum: NullableNamedEnum | null;',
  "inlineEnum: 'one' | 'two' | null;",
  'target: NullableTargetDto | null;',
];

const missing = expected.filter((line) => !body.includes(line));
if (missing.length > 0) {
  console.error(`❌ Nullable contract broken. Missing:\n  ${missing.join('\n  ')}\nGot:${body}`);
  process.exit(1);
}

console.log('✅ Nullable enums/refs keep `| null` in generated types');
