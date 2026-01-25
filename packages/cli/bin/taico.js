#!/usr/bin/env node
import { Command } from 'commander';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import concurrently from 'concurrently';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const program = new Command();
program
    .name('taico')
    .description('CLI tool to run taico server and worker')
    .version('0.0.1');
program
    .command('server')
    .description('Run the taico server (backend + UI)')
    .action(async () => {
    console.log('🚀 Starting taico server...');
    // Find the monorepo root (go up from packages/cli/bin to root)
    const monorepoRoot = join(__dirname, '..', '..', '..');
    const backendPath = join(monorepoRoot, 'apps', 'backend');
    // Run the backend server using npm
    const serverProcess = spawn('npm', ['run', 'start:prod'], {
        cwd: backendPath,
        stdio: 'inherit',
        shell: true,
        env: { ...process.env }
    });
    serverProcess.on('error', (error) => {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    });
    serverProcess.on('exit', (code) => {
        if (code !== 0) {
            console.error(`❌ Server exited with code ${code}`);
            process.exit(code || 1);
        }
    });
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n👋 Shutting down server...');
        serverProcess.kill('SIGINT');
        process.exit(0);
    });
});
program
    .command('worker')
    .description('Run the taico worker/agent')
    .option('-s, --server-url <url>', 'URL of the server to connect to', 'http://localhost:3000')
    .action(async (options) => {
    console.log(`🤖 Starting taico worker (connecting to ${options.serverUrl})...`);
    // Find the monorepo root
    const monorepoRoot = join(__dirname, '..', '..', '..');
    const agentsPath = join(monorepoRoot, 'apps', 'agents');
    // Set the server URL as an environment variable
    const env = {
        ...process.env,
        TAICO_SERVER_URL: options.serverUrl,
    };
    // Run the agents worker using npm
    const workerProcess = spawn('npm', ['run', 'start'], {
        cwd: agentsPath,
        stdio: 'inherit',
        shell: true,
        env
    });
    workerProcess.on('error', (error) => {
        console.error('❌ Failed to start worker:', error);
        process.exit(1);
    });
    workerProcess.on('exit', (code) => {
        if (code !== 0) {
            console.error(`❌ Worker exited with code ${code}`);
            process.exit(code || 1);
        }
    });
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n👋 Shutting down worker...');
        workerProcess.kill('SIGINT');
        process.exit(0);
    });
});
// Default action - run both server and worker
program
    .action(async () => {
    console.log('🚀 Starting taico server and worker...');
    // Find the monorepo root
    const monorepoRoot = join(__dirname, '..', '..', '..');
    const backendPath = join(monorepoRoot, 'apps', 'backend');
    const agentsPath = join(monorepoRoot, 'apps', 'agents');
    try {
        const { result } = concurrently([
            {
                command: 'npm run start:prod',
                name: 'server',
                cwd: backendPath,
                prefixColor: 'blue'
            },
            {
                command: 'npm run start',
                name: 'worker',
                cwd: agentsPath,
                prefixColor: 'green'
            }
        ], {
            prefix: 'name',
            killOthers: ['failure', 'success'],
            restartTries: 0,
        });
        await result;
    }
    catch (error) {
        console.error('❌ Error running taico:', error);
        process.exit(1);
    }
});
program.parse();
