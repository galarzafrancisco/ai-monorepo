#!/usr/bin/env node

import { startWorkerApp } from './worker-app.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const help = args.includes('--help') || args.includes('-h');

  if (help) {
    printUsage();
    return;
  }

  const serverUrl = readCliOption(args, '--serverurl');
  if (!serverUrl) {
    throw new Error('Missing required --serverurl');
  }

  const credentialsPath =
    readCliOption(args, '--credentials-path') ?? undefined;

  await startWorkerApp({
    serverUrl,
    credentialsPath,
  });
}

function printUsage(): void {
  console.log(`taico-worker-v2 usage:

  taico-worker-v2 --serverurl <url> [--credentials-path <path>]
    Start worker mode against an existing Taico server.
`);
}

function readCliOption(args: string[], name: string): string | null {
  const index = args.indexOf(name);
  if (index === -1) {
    return null;
  }

  return args[index + 1] ?? null;
}

void main();
