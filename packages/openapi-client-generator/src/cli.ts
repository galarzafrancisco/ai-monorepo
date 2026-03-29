#!/usr/bin/env node

import { generate } from './index.js';

const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('Usage: openapi-client-gen <input-spec.json> <output-dir>');
  process.exit(1);
}

const [inputPath, outputDir] = args;

generate({ inputPath, outputDir })
  .then(() => {
    console.log('✓ Client generation complete');
  })
  .catch((error) => {
    console.error('Error generating client:', error);
    process.exit(1);
  });
