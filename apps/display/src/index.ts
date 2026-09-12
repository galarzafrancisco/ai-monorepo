#!/usr/bin/env node

import { startDisplayApp } from './display-app.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: taico-display --serverurl <url> [--device-name ai-monitor] [--credentials-path <path>]');
    return;
  }
  const serverUrl = option(args, '--serverurl');
  if (!serverUrl) throw new Error('Missing required --serverurl');
  await startDisplayApp({ serverUrl, deviceName: option(args, '--device-name') ?? 'ai-monitor', credentialsPath: option(args, '--credentials-path') ?? undefined });
}

function option(args: string[], name: string): string | null {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1] ?? null;
}

void main();
