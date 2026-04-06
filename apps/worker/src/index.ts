#!/usr/bin/env node

import { resolve } from 'node:path';
import { DEFAULT_WORKER_WORKSPACES_PATH } from './auth/credentials-store.js';
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
  const workingDirectory = resolve(
    readCliOption(args, '--working-directory') ?? DEFAULT_WORKER_WORKSPACES_PATH,
  );

  await startWorkerApp({
    serverUrl,
    credentialsPath,
    workingDirectory,
  });
}

function printUsage(): void {
  console.log(`taico-worker usage:

  taico-worker --serverurl <url> [--credentials-path <path>] [--working-directory <path>]
    Start worker mode against an existing Taico server.
    Working directory defaults to ~/.taico/workspaces.
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
