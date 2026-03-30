import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';

const api = spawn('npm', ['run', 'test:api'], { stdio: 'inherit' });

const cleanup = () => api.kill();
process.on('exit', cleanup);
process.on('SIGINT', cleanup);

await waitForReady('http://localhost:3456/api-json');

const tests = spawn('npm', ['run', 'test:client'], { stdio: 'inherit' });
const code = await onExit(tests);
process.exit(code);

async function waitForReady(url, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try { await fetch(url); return; } catch {}
    await sleep(200);
  }
  throw new Error(`Server not ready after ${timeout}ms`);
}

function onExit(proc) {
  return new Promise((res) => proc.on('close', res));
}
