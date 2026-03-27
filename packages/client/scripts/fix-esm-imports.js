#!/usr/bin/env node
/**
 * Adds .js extensions to relative imports in generated client files.
 * Required for ESM compatibility with "type": "module".
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const CLIENT_DIR = new URL('../src/client', import.meta.url).pathname;

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(path);
    } else if (entry.name.endsWith('.ts')) {
      yield path;
    }
  }
}

async function fixImports(filePath) {
  const content = await readFile(filePath, 'utf-8');

  // Match: from './path' or from '../path' (without .js)
  // Replace with: from './path.js' or from '../path.js'
  let fixed = content.replace(
    /from '(\.\.?\/[^']+)(?<!\.js)'/g,
    "from '$1.js'"
  );

  if (filePath.includes('/services/')) {
    if (!fixed.includes("import type { OpenAPIConfig } from '../core/OpenAPI.js';")) {
      fixed = fixed.replace(
        "import { OpenAPI } from '../core/OpenAPI.js';",
        "import { OpenAPI } from '../core/OpenAPI.js';\nimport type { OpenAPIConfig } from '../core/OpenAPI.js';"
      );
    }

    fixed = fixed
      .replace(
        /import type \{ OpenAPIConfig \} from '\.\.\/core\/OpenAPI\.js';\n(import type \{ OpenAPIConfig \} from '\.\.\/core\/OpenAPI\.js';\n)+/g,
        "import type { OpenAPIConfig } from '../core/OpenAPI.js';\n"
      )
      .replace(
        /(public static [^(]+\(([^)]*)\)\s*:[^{]+\{)/g,
        (_match, fullSignature, args) => {
          const trimmedArgs = args.trim();
          if (!trimmedArgs) {
            return fullSignature.replace('()', '(config: OpenAPIConfig = OpenAPI)');
          }
          if (trimmedArgs.includes('config: OpenAPIConfig = OpenAPI')) {
            return fullSignature;
          }
          const normalizedArgs = args.replace(/\s*,\s*$/, '');
          return fullSignature.replace(
            `(${args})`,
            `(${normalizedArgs},\n        config: OpenAPIConfig = OpenAPI,)`
          );
        }
      )
      .replace(/__request\(OpenAPI,\s*\{/g, '__request(config, {')
      .replace(/,\s*,/g, ',')
      .replace(/config: OpenAPIConfig = OpenAPI,\):/g, 'config: OpenAPIConfig = OpenAPI,\n    ):');
  }

  if (fixed !== content) {
    await writeFile(filePath, fixed);
    console.log(`Fixed: ${filePath}`);
  }
}

async function main() {
  let count = 0;
  for await (const file of walk(CLIENT_DIR)) {
    await fixImports(file);
    count++;
  }
  console.log(`Processed ${count} files`);
}

main().catch(console.error);
