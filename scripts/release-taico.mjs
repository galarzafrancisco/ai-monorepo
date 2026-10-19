#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

const packageReleaseOrder = [
  "packages/shared",
  "packages/events",
  "packages/errors",
  "packages/adk-session-store",
  "packages/openapi-sdkgen",
  "packages/client",
];

const appReleaseOrder = ["apps/backend", "apps/worker", "apps/display"];
const socketBadgeMarker = "[![Socket Badge]";

const releaseVersionTextTargets = [
  {
    relativePath: "helpers/start-server.sh",
    patterns: [/ghcr\.io\/galarzafrancisco\/ai-monorepo:\d+\.\d+\.\d+/g],
  },
  {
    relativePath: "helpers/start-worker.sh",
    patterns: [/@taico\/worker@\d+\.\d+\.\d+/g],
  },
];

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function workspacePackageJsonPaths() {
  const roots = ["packages", "apps"];
  const paths = [];

  for (const root of roots) {
    const absoluteRoot = path.join(repoRoot, root);
    if (!existsSync(absoluteRoot)) {
      continue;
    }

    for (const entry of readdirSync(absoluteRoot)) {
      const packageJsonPath = path.join(absoluteRoot, entry, "package.json");
      if (
        existsSync(packageJsonPath) &&
        statSync(path.dirname(packageJsonPath)).isDirectory()
      ) {
        paths.push(packageJsonPath);
      }
    }
  }

  return paths.sort();
}

function isTaicoPackageName(name) {
  return typeof name === "string" && name.startsWith("@taico/");
}

function bumpDependencySet(dependencies, fromVersion, toVersion) {
  if (!dependencies) {
    return false;
  }

  let changed = false;
  for (const [name, versionRange] of Object.entries(dependencies)) {
    if (!isTaicoPackageName(name) || typeof versionRange !== "string") {
      continue;
    }

    const nextRange = versionRange.replaceAll(fromVersion, toVersion);
    if (nextRange !== versionRange) {
      dependencies[name] = nextRange;
      changed = true;
    }
  }

  return changed;
}

function bumpPackageJson(filePath, fromVersion, toVersion) {
  const manifest = readJson(filePath);
  let changed = false;

  if (isTaicoPackageName(manifest.name) && manifest.version === fromVersion) {
    manifest.version = toVersion;
    changed = true;
  }

  for (const key of [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ]) {
    changed = bumpDependencySet(manifest[key], fromVersion, toVersion) || changed;
  }

  if (changed) {
    writeJson(filePath, manifest);
  }

  return { changed, name: manifest.name, relativePath: path.relative(repoRoot, filePath) };
}

function bumpPackageLock(fromVersion, toVersion) {
  const lockPath = path.join(repoRoot, "package-lock.json");
  if (!existsSync(lockPath)) {
    return { changed: false, relativePath: "package-lock.json" };
  }

  const lockfile = readJson(lockPath);
  let changed = false;

  for (const packageInfo of Object.values(lockfile.packages ?? {})) {
    if (!packageInfo || typeof packageInfo !== "object") {
      continue;
    }

    if (isTaicoPackageName(packageInfo.name) && packageInfo.version === fromVersion) {
      packageInfo.version = toVersion;
      changed = true;
    }

    for (const key of [
      "dependencies",
      "devDependencies",
      "peerDependencies",
      "optionalDependencies",
    ]) {
      changed =
        bumpDependencySet(packageInfo[key], fromVersion, toVersion) || changed;
    }
  }

  if (changed) {
    writeJson(lockPath, lockfile);
  }

  return { changed, relativePath: path.relative(repoRoot, lockPath) };
}

function bumpTextFile(target, fromVersion, toVersion) {
  const { relativePath, patterns } = target;
  const filePath = path.join(repoRoot, relativePath);
  if (!existsSync(filePath)) {
    return { changed: false, relativePath };
  }

  const current = readFileSync(filePath, "utf8");
  let next = current.replaceAll(fromVersion, toVersion);
  for (const pattern of patterns) {
    next = next.replace(pattern, (match) =>
      match.replace(/\d+\.\d+\.\d+$/, toVersion),
    );
  }
  if (next === current) {
    return { changed: false, relativePath };
  }

  writeFileSync(filePath, next);
  return { changed: true, relativePath };
}

function socketBadgeMarkdown(name, version) {
  const badgeUrl = `https://badge.socket.dev/npm/package/${name}/${version}`;
  return `[![Socket Badge](${badgeUrl})](${badgeUrl})`;
}

function defaultReadmeTitle(manifest) {
  return `# ${manifest.name}\n`;
}

function syncSocketBadge(workspace) {
  const packageJsonPath = path.join(repoRoot, workspace, "package.json");
  const readmePath = path.join(repoRoot, workspace, "README.md");
  const manifest = readJson(packageJsonPath);
  const badge = socketBadgeMarkdown(manifest.name, manifest.version);
  const current = existsSync(readmePath)
    ? readFileSync(readmePath, "utf8")
    : defaultReadmeTitle(manifest);
  const lines = current.split("\n");
  const existingBadgeIndex = lines.findIndex((line) =>
    line.startsWith(socketBadgeMarker),
  );

  let next;
  if (existingBadgeIndex >= 0) {
    lines[existingBadgeIndex] = badge;
    next = lines.join("\n");
  } else {
    const insertAt = lines[0]?.startsWith("# ") ? 1 : 0;
    lines.splice(insertAt, 0, "", badge);
    next = lines.join("\n");
  }

  if (!next.endsWith("\n")) {
    next = `${next}\n`;
  }

  if (next !== current) {
    writeFileSync(readmePath, next);
    return { changed: true, relativePath: path.relative(repoRoot, readmePath) };
  }

  return { changed: false, relativePath: path.relative(repoRoot, readmePath) };
}

function syncSocketBadges() {
  const results = [...packageReleaseOrder, ...appReleaseOrder].map((workspace) =>
    syncSocketBadge(workspace),
  );
  const changed = results.filter((result) => result.changed);

  if (changed.length === 0) {
    console.log("Socket badges already up to date.");
    return;
  }

  console.log("Updated Socket badges:");
  for (const result of changed) {
    console.log(`- ${result.relativePath}`);
  }
}

function parseFlag(name, fallback) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function commandName() {
  return process.argv[2] ?? "help";
}

async function runCommand(command, args, options = {}) {
  console.log(`\n> ${[command, ...args].join(" ")}`);
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: "inherit",
      shell: false,
      ...options,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

const semverPattern = /^\d+\.\d+\.\d+$/;

/**
 * The bump rewrites the helper scripts to `toVersion` whatever version they
 * pin, so it must only run with versions the caller chose on purpose.
 */
function requireBumpVersions(fromVersion, toVersion) {
  if (!fromVersion || !toVersion) {
    throw new Error("bump needs --from=<current version> and --to=<new version>.");
  }
  for (const version of [fromVersion, toVersion]) {
    if (!semverPattern.test(version)) {
      throw new Error(`"${version}" is not a version like 1.2.3.`);
    }
  }
  const current = readJson(path.join(repoRoot, "apps/backend/package.json")).version;
  if (current !== fromVersion) {
    throw new Error(
      `--from=${fromVersion} does not match the current version ${current}. Nothing was changed.`,
    );
  }
}

function bump(fromVersion, toVersion) {
  requireBumpVersions(fromVersion, toVersion);
  const results = workspacePackageJsonPaths().map((filePath) =>
    bumpPackageJson(filePath, fromVersion, toVersion),
  );
  const lockResult = bumpPackageLock(fromVersion, toVersion);
  const textResults = releaseVersionTextTargets.map((target) =>
    bumpTextFile(target, fromVersion, toVersion),
  );

  const changed = [...results, lockResult, ...textResults].filter(
    (result) => result.changed,
  );
  if (changed.length === 0) {
    console.log(`No @taico versions or dependencies matched ${fromVersion}.`);
    syncSocketBadges();
    return;
  }

  console.log(`Bumped @taico manifests from ${fromVersion} to ${toVersion}:`);
  for (const result of changed) {
    console.log(`- ${result.relativePath}`);
  }

  syncSocketBadges();
}

function packageNames(workspaces) {
  return workspaces.map(
    (workspace) => readJson(path.join(repoRoot, workspace, "package.json")).name,
  );
}

function isLoggedInToNpm() {
  return spawnSync("npm", ["whoami"], { cwd: repoRoot, stdio: "ignore" }).status === 0;
}

function isPublished(workspace) {
  const { name, version } = readJson(path.join(repoRoot, workspace, "package.json"));
  const result = spawnSync("npm", ["view", `${name}@${version}`, "version"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return result.status === 0 && result.stdout.trim() === version;
}

function printPlan() {
  console.log("Release order:");
  console.log("- npm run build:dev");
  console.log("- nx build:prod for every package");
  console.log("- npm login (skipped if already logged in)");
  for (const workspace of [...packageReleaseOrder, ...appReleaseOrder]) {
    console.log(`- npm publish -w ${workspace} (skipped if already published)`);
  }
}

/**
 * Everything is built before signing in, so the sign-in and the npm 2FA
 * prompt of the first publish come together and the publishes run back to
 * back. build:dev builds the apps (the backend must not be rebuilt outside
 * nx, which assembles its public assets) but not every package, hence the
 * second build; nx serves what build:dev already built from its cache.
 */
async function release() {
  printPlan();

  await runCommand("npm", ["run", "build:dev"]);
  await runCommand("npx", [
    "nx",
    "run-many",
    "-t",
    "build:prod",
    "-p",
    packageNames(packageReleaseOrder).join(","),
  ]);

  if (!isLoggedInToNpm()) {
    await runCommand("npm", ["login"]);
  }
  for (const workspace of [...packageReleaseOrder, ...appReleaseOrder]) {
    if (isPublished(workspace)) {
      console.log(`\n${workspace} is already published at this version, skipping.`);
      continue;
    }
    await runCommand("npm", ["publish", "-w", workspace, "--access", "public"]);
  }

  console.log("\nRelease complete.");
}

function usage() {
  console.log(`Usage:
  node scripts/release-taico.mjs bump --from=<current> --to=<new>
  node scripts/release-taico.mjs socket-badges
  node scripts/release-taico.mjs release
  node scripts/release-taico.mjs all --from=<current> --to=<new>

Commands:
  bump     Update every @taico package version and @taico dependency range.
  socket-badges
           Update Socket badge URLs from release target package manifests.
  release  Build, log in, then publish packages followed by the apps.
  all      Run bump and then release.
`);
}

const fromVersion = parseFlag("from");
const toVersion = parseFlag("to");

try {
  switch (commandName()) {
    case "bump":
      bump(fromVersion, toVersion);
      break;
    case "socket-badges":
      syncSocketBadges();
      break;
    case "release":
      await release();
      break;
    case "all":
      bump(fromVersion, toVersion);
      await release();
      break;
    default:
      usage();
      process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
