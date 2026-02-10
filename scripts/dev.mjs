import { spawn } from 'child_process';
import net from 'net';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const backendArgs = ['-w', 'apps/backend', 'run', 'dev'];
const uiArgs = ['-w', 'apps/ui', 'run', 'dev'];
const ui2Args = ['-w', 'apps/ui2', 'run', 'dev'];

const UI2_PORT = 2000;
const UI_PORT = 2001;
const BACKEND_START_PORT = 3000;
const MAX_PORT_ATTEMPTS = 20;

const portPattern = /Application is running on: http:\/\/localhost:(\d+)/;
const children = new Set();
let uiStarted = false;
let shuttingDown = false;

async function findAvailablePort(startPort, maxAttempts) {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    const available = await isPortAvailable(port);
    if (available) {
      return port;
    }
    console.log(`Port ${port} is in use, trying ${port + 1}...`);
  }
  throw new Error(
    `Unable to find an available port starting at ${startPort} after ${maxAttempts} attempts.`
  );
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

async function startBackend() {
  const backendPort = await findAvailablePort(BACKEND_START_PORT, MAX_PORT_ATTEMPTS);
  console.log(`Starting backend on port ${backendPort}...`);

  const env = {
    ...process.env,
    BACKEND_PORT: String(backendPort),
    ISSUER_URL: `http://localhost:${UI2_PORT}`,
  };

  const backend = spawn(npmCommand, backendArgs, {
    env,
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
}

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

function startFrontends(backendPort) {
  console.log(`Starting UI processes with backend port ${backendPort}.`);

  // Start ui2 on port 2000
  const ui2Env = {
    ...process.env,
    VITE_BACKEND_PORT: backendPort,
    VITE_PORT: String(UI2_PORT),
  };
  const ui2 = spawn(npmCommand, ui2Args, { env: ui2Env, stdio: 'inherit' });
  trackProcess(ui2, 'ui2');

  // Start ui (legacy) on port 2001
  const uiEnv = {
    ...process.env,
    VITE_BACKEND_PORT: backendPort,
    VITE_PORT: String(UI_PORT),
  };
  const ui = spawn(npmCommand, uiArgs, { env: uiEnv, stdio: 'inherit' });
  trackProcess(ui, 'ui');
}

// Start the backend
startBackend().catch((error) => {
  console.error('Failed to start backend:', error);
  process.exit(1);
});

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
