import { spawn } from 'child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const backendArgs = ['-w', 'apps/backend', 'run', 'dev'];
const uiArgs = ['-w', 'apps/ui', 'run', 'dev'];
const ui2Args = ['-w', 'apps/ui2', 'run', 'dev'];

const portPattern = /Application is running on: http:\/\/localhost:(\d+)/;
const children = new Set();
let uiStarted = false;
let shuttingDown = false;

const backend = spawn(npmCommand, backendArgs, {
  env: process.env,
  stdio: ['inherit', 'pipe', 'pipe'],
});

trackProcess(backend, 'backend');

backend.stdout.on('data', (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);
  handleBackendOutput(text);
});

backend.stderr.on('data', (chunk) => {
  const text = chunk.toString();
  process.stderr.write(text);
  handleBackendOutput(text);
});

backend.on('error', (error) => {
  console.error('Failed to start backend process:', error);
  shutdown(1);
});

function handleBackendOutput(text) {
  if (uiStarted) {
    return;
  }

  const match = text.match(portPattern);
  if (!match) {
    return;
  }

  const port = match[1];
  uiStarted = true;
  startFrontends(port);
}

function startFrontends(port) {
  console.log(`Starting UI processes with backend port ${port}.`);
  const env = { ...process.env, VITE_BACKEND_PORT: port };

  const ui2 = spawn(npmCommand, ui2Args, { env, stdio: 'inherit' });
  trackProcess(ui2, 'ui2');

  const ui = spawn(npmCommand, uiArgs, { env, stdio: 'inherit' });
  trackProcess(ui, 'ui');
}

function trackProcess(child, name) {
  children.add(child);

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    const exitCode = code ?? (signal ? 1 : 0);
    console.warn(`${name} exited. Shutting down other processes.`);
    shutdown(exitCode);
  });
}

function shutdown(exitCode) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of children) {
    child.kill('SIGINT');
  }
  process.exit(exitCode);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
