import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parseOpenAPISpec } from './parser.js';
import { generateClient } from './generator.js';
import type { GeneratorConfig } from './types.js';

export async function generate(config: GeneratorConfig): Promise<void> {
  // Read OpenAPI spec
  const specContent = readFileSync(config.inputPath, 'utf-8');
  const spec = JSON.parse(specContent);

  // Parse spec
  const parsed = parseOpenAPISpec(spec);

  // Generate files
  const files = generateClient(parsed);

  // Write files
  mkdirSync(config.outputDir, { recursive: true });

  for (const [filename, content] of files) {
    const filePath = join(config.outputDir, filename);
    writeFileSync(filePath, content, 'utf-8');
    console.log(`Generated: ${filePath}`);
  }

  console.log(`✓ Generated ${files.size} files in ${config.outputDir}`);
}

export * from './types.js';
export { parseOpenAPISpec } from './parser.js';
export { generateClient } from './generator.js';
