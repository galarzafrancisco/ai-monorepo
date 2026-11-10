#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_WORKER_WORKSPACES_PATH } from './auth/credentials-store.js';
import { startWorkerApp } from './worker-app.js';
import { installFetchProxy } from './helpers/proxy.js';

const WORKSPACE_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

async function main(): Promise<void> {
  // Behind a proxy, Node's fetch ignores HTTPS_PROXY unless told otherwise.
  if (installFetchProxy()) {
    console.log('[worker] Using the proxy from HTTPS_PROXY (NO_PROXY honoured).');
  }
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
  const workspace = readCliOption(args, '--workspace') ?? undefined;
  if (workspace !== undefined && !WORKSPACE_SLUG_PATTERN.test(workspace)) {
    throw new Error(
      `Invalid --workspace "${workspace}": use the workspace slug (lowercase letters, digits and hyphens), as shown in Settings.`,
    );
  }
  const workingDirectory = resolve(
    readCliOption(args, '--working-directory') ?? DEFAULT_WORKER_WORKSPACES_PATH,
  );

  const version = getAppVersion();
  console.log(`🚀 Starting Taico worker v${version}...`);

  await startWorkerApp({
    serverUrl,
    credentialsPath,
    workspace,
    workingDirectory,
  });
}

function printUsage(): void {
  console.log(`taico-worker usage:

  taico-worker --serverurl <url> [--workspace <slug>] [--credentials-path <path>] [--working-directory <path>]
    Start worker mode against an existing Taico server.
    --workspace connects the worker to that workspace: it must be approved
    there, and its credentials are kept apart from workers of other
    workspaces. Without it, the worker joins the workspace it is approved in.
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

function getAppVersion(): string {
  const packageJsonPath = join(__dirname, '..', 'package.json');

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      version?: unknown;
    };

    if (typeof packageJson.version === 'string' && packageJson.version) {
      return packageJson.version;
    }
  } catch (error) {
    console.warn(
      `Unable to read app version from ${packageJsonPath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  return '0.0.0';
}

void main();
