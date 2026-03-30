#!/usr/bin/env node

import { resolve } from 'path';
import { generate } from './index.js';

const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('Usage: openapi-sdkgen <input-spec.json> <output-dir>');
  process.exit(1);
}

const [inputPath, outputDir] = args;
const invocationDir = process.env.npm_lifecycle_event
  ? process.cwd()
  : (process.env.INIT_CWD || process.cwd());
const resolvedInputPath = resolve(invocationDir, inputPath);
const resolvedOutputDir = resolve(invocationDir, outputDir);

generate({ inputPath: resolvedInputPath, outputDir: resolvedOutputDir })
  .then(() => {
    console.log('✓ Client generation complete');
  })
  .catch((error) => {
    console.error('Error generating client:', error);
    process.exit(1);
  });
