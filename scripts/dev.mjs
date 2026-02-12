import { spawn } from 'child_process';
import net from 'net';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const backendArgs = ['-w', 'apps/backend', 'run', 'dev'];
const uiArgs = ['-w', 'apps/ui', 'run', 'dev'];
const ui2Args = ['-w', 'apps/ui2', 'run', 'dev'];

const portPattern = /Application is running on: http:\/\/localhost:(\d+)/;
const addressInUsePattern = /EADDRINUSE|address already in use/i;
const children = new Set();
let shuttingDown = false;

const ui2Port = Number(process.env.VITE_PORT || 2000);
const uiPort = 2001;
const backendPortStart = Number(
  process.env.BACKEND_PORT || process.env.PORT || 3000,
);
const backendPortSearchLimit = Number(
  process.env.BACKEND_PORT_SEARCH_LIMIT || 20,
);
const backendStartupTimeoutMs = Number(
  process.env.BACKEND_STARTUP_TIMEOUT_MS || 10000,
);

await start();

async function start() {
  const { child, port } = await startBackendWithFallback();
  trackProcess(child, 'backend');
  startFrontends(port);
}

async function startBackendWithFallback() {
  for (let attempt = 0; attempt < backendPortSearchLimit; attempt += 1) {
    const port = backendPortStart + attempt;
    const available = await isPortAvailable(port);
    if (!available) {
      console.warn(`Port ${port} is in use. Trying next.`);
      continue;
    }

    try {
      const result = await startBackendOnPort(port);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Backend failed on port ${port}: ${message}`);
    }
  }

  throw new Error('Unable to start backend after trying all ports.');
}

function startBackendOnPort(port) {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      BACKEND_PORT: String(port),
      ISSUER_URL: process.env.ISSUER_URL || `http://localhost:${ui2Port}`,
      VITE_PORT: String(ui2Port),
    };

    const child = spawn(npmCommand, backendArgs, {
      env,
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    let settled = false;
    const startupTimeout = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      cleanupStartup();
      child.kill('SIGINT');
      reject(new Error('Backend startup timed out.'));
    }, backendStartupTimeoutMs);

    // Keep piping output after startup
    const pipeStdout = (chunk) => process.stdout.write(chunk);
    const pipeStderr = (chunk) => process.stderr.write(chunk);

    const handleOutput = (chunk, stream) => {
      const text = chunk.toString();
      stream.write(text);

      if (addressInUsePattern.test(text)) {
        if (!settled) {
          settled = true;
          cleanupStartup();
          child.kill('SIGINT');
          reject(new Error('Address already in use.'));
        }
        return;
      }

      const match = text.match(portPattern);
      if (match && !settled) {
        settled = true;
        cleanupStartup();
        // Keep piping logs after successful startup
        child.stdout.on('data', pipeStdout);
        child.stderr.on('data', pipeStderr);
        resolve({ child, port: Number(match[1]) });
      }
    };

    const handleStdout = (chunk) => handleOutput(chunk, process.stdout);
    const handleStderr = (chunk) => handleOutput(chunk, process.stderr);

    const handleExit = (code, signal) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanupStartup();
      reject(
        new Error(
          `Backend exited before ready (code ${code ?? 'null'}, signal ${signal ?? 'null'}).`,
        ),
      );
    };

    const handleError = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanupStartup();
      reject(error);
    };

    child.stdout.on('data', handleStdout);
    child.stderr.on('data', handleStderr);
    child.on('exit', handleExit);
    child.on('error', handleError);

    function cleanupStartup() {
      clearTimeout(startupTimeout);
      child.stdout.off('data', handleStdout);
      child.stderr.off('data', handleStderr);
      child.off('exit', handleExit);
      child.off('error', handleError);
    }
  });
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        resolve(false);
      }
    });

    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    server.listen(port, '127.0.0.1');
    server.unref();
  });
}

function startFrontends(port) {
  console.log(`Starting UI processes with backend port ${port}.`);

  const ui2Env = {
    ...process.env,
    VITE_BACKEND_PORT: String(port),
    VITE_PORT: String(ui2Port),
  };
  const ui2 = spawn(npmCommand, ui2Args, { env: ui2Env, stdio: 'inherit' });
  trackProcess(ui2, 'ui2');

  const uiEnv = {
    ...process.env,
    VITE_BACKEND_PORT: String(port),
    VITE_PORT: String(uiPort),
  };
  const ui = spawn(npmCommand, uiArgs, { env: uiEnv, stdio: 'inherit' });
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
