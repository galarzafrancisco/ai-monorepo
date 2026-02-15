import { execSync } from 'node:child_process';

const MIN_WORKER_NODE_MAJOR = 24;
const majorVersion = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10);

if (Number.isNaN(majorVersion) || majorVersion < MIN_WORKER_NODE_MAJOR) {
  console.log(
    `[build:worker:if-supported] Skipping worker build on Node ${process.version}; worker build requires Node >=${MIN_WORKER_NODE_MAJOR}.`,
  );
  console.log(
    '[build:worker:if-supported] Run `npm -w apps/worker run build` on Node 24+ to validate worker packaging.',
  );
  process.exit(0);
}

console.log(`[build:worker:if-supported] Node ${process.version} detected; running worker build...`);
execSync('npm -w apps/worker run build', { stdio: 'inherit' });
