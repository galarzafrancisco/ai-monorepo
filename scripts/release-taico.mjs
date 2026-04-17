#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
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
const defaultFromVersion = "0.2.13";
const defaultToVersion = "0.2.14";

const packageReleaseOrder = [
  "packages/shared",
  "packages/events",
  "packages/errors",
  "packages/adk-session-store",
  "packages/openapi-sdkgen",
  "packages/client",
];

const appReleaseOrder = ["apps/backend", "apps/worker"];

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

function parseFlag(name, fallback) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function commandName() {
  return process.argv[2] ?? "help";
}

async function confirm(rl, message) {
  const answer = await rl.question(`${message} [y/N] `);
  return answer.trim().toLowerCase() === "y";
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

function bump(fromVersion, toVersion) {
  const results = workspacePackageJsonPaths().map((filePath) =>
    bumpPackageJson(filePath, fromVersion, toVersion),
  );
  const lockResult = bumpPackageLock(fromVersion, toVersion);

  const changed = [...results, lockResult].filter((result) => result.changed);
  if (changed.length === 0) {
    console.log(`No @taico versions or dependencies matched ${fromVersion}.`);
    return;
  }

  console.log(`Bumped @taico manifests from ${fromVersion} to ${toVersion}:`);
  for (const result of changed) {
    console.log(`- ${result.relativePath}`);
  }
}

function printPlan() {
  console.log("Release order:");
  console.log("- npm login");
  console.log("- npm run build:dev");
  for (const workspace of packageReleaseOrder) {
    console.log(`- npm -w ${workspace} run release`);
  }
  for (const workspace of appReleaseOrder) {
    console.log(`- npm -w ${workspace} run release`);
  }
}

async function release() {
  printPlan();

  const rl = createInterface({ input, output });
  try {
    if (!(await confirm(rl, "Run npm login now?"))) {
      throw new Error("Release cancelled before npm login.");
    }
    await runCommand("npm", ["login"]);

    if (!(await confirm(rl, "Build everything with npm run build:dev?"))) {
      throw new Error("Release cancelled before build.");
    }
    await runCommand("npm", ["run", "build:dev"]);

    for (const workspace of [...packageReleaseOrder, ...appReleaseOrder]) {
      if (!(await confirm(rl, `Release ${workspace}?`))) {
        throw new Error(`Release cancelled before ${workspace}.`);
      }
      await runCommand("npm", ["-w", workspace, "run", "release"]);
    }

    console.log("\nRelease complete.");
  } finally {
    rl.close();
  }
}

function usage() {
  console.log(`Usage:
  node scripts/release-taico.mjs bump [--from=${defaultFromVersion}] [--to=${defaultToVersion}]
  node scripts/release-taico.mjs release
  node scripts/release-taico.mjs all [--from=${defaultFromVersion}] [--to=${defaultToVersion}]

Commands:
  bump     Update every @taico package version and @taico dependency range.
  release  Login, build, then publish packages followed by backend and worker.
  all      Run bump and then release.
`);
}

const fromVersion = parseFlag("from", defaultFromVersion);
const toVersion = parseFlag("to", defaultToVersion);

try {
  switch (commandName()) {
    case "bump":
      bump(fromVersion, toVersion);
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
