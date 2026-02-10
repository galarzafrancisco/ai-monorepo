import { spawn } from 'child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const backendArgs = ['-w', 'apps/backend', 'run', 'dev'];
const uiArgs = ['-w', 'apps/ui', 'run', 'dev'];
const ui2Args = ['-w', 'apps/ui2', 'run', 'dev'];

const portPattern = /Application is running on: http:\/\/localhost:(\d+)/;
const addressInUsePattern = /EADDRINUSE|address already in use/i;
const children = new Set();
let uiStarted = false;
let shuttingDown = false;

const backendBasePort = parseInt(
  process.env.BACKEND_PORT || process.env.PORT || '3000',
  10,
);
const backendPortSearchLimit = parseInt(
  process.env.BACKEND_PORT_SEARCH_LIMIT || '20',
  10,
);
const ui2Port = parseInt(process.env.VITE_PORT || '2000', 10);
const uiPort = parseInt(process.env.VITE_LEGACY_PORT || '2001', 10);
const issuerUrl = process.env.ISSUER_URL || `http://localhost:${ui2Port}`;

startBackendWithFallback()
  .then(({ backendPort, backendProcess }) => {
    trackProcess(backendProcess, 'backend');
    startFrontends(backendPort);
  })
  .catch((error) => {
    console.error(error.message ?? error);
    shutdown(1);
  });

async function startBackendWithFallback() {
  for (let attempt = 0; attempt < backendPortSearchLimit; attempt += 1) {
    const port = backendBasePort + attempt;
    try {
      console.log(`Starting backend on port ${port}.`);
      const backendProcess = await startBackend(port);
      return { backendPort: port, backendProcess };
    } catch (error) {
      if (error instanceof Error && error.message === 'EADDRINUSE') {
        console.warn(`Port ${port} is in use, trying ${port + 1}.`);
        continue;
      }
      throw error;
    }
  }

  throw new Error(
    `Unable to find an open backend port starting at ${backendBasePort} after ${backendPortSearchLimit} attempts.`,
  );
}

function startBackend(port) {
  return new Promise((resolve, reject) => {
    let backendReady = false;
    let sawAddressInUse = false;
    let startupFailed = false;
    let outputBuffer = '';

    const env = {
      ...process.env,
      BACKEND_PORT: String(port),
      ISSUER_URL: issuerUrl,
    };

    const backend = spawn(npmCommand, backendArgs, {
      env,
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    const handleOutput = (text, stream) => {
      stream.write(text);
      outputBuffer += text;
      if (addressInUsePattern.test(text)) {
        sawAddressInUse = true;
        if (!backendReady && !startupFailed) {
          startupFailed = true;
          backend.kill('SIGINT');
          reject(new Error('EADDRINUSE'));
          return;
        }
      }
      const match = text.match(portPattern);
      if (match && !backendReady) {
        backendReady = true;
        resolve(backend);
      }
    };

    backend.stdout.on('data', (chunk) => {
      handleOutput(chunk.toString(), process.stdout);
    });

    backend.stderr.on('data', (chunk) => {
      handleOutput(chunk.toString(), process.stderr);
    });

    backend.on('error', (error) => {
      if (backendReady || startupFailed) {
        return;
      }
      reject(error);
    });

    backend.on('exit', (code, signal) => {
      if (backendReady) {
        return;
      }
      if (sawAddressInUse || addressInUsePattern.test(outputBuffer)) {
        reject(new Error('EADDRINUSE'));
        return;
      }
      const exitCode = code ?? (signal ? 1 : 0);
      reject(
        new Error(`Backend exited before start (code ${exitCode}).`),
      );
    });
  });
}

function startFrontends(port) {
  if (uiStarted) {
    return;
  }

  uiStarted = true;
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
