import { execFileSync, spawnSync } from 'node:child_process';

type ProcRow = { pid: number; ppid: number; pgid: number };

function listProcesses(): ProcRow[] {
  const out = execFileSync('ps', ['-A', '-o', 'pid=,ppid=,pgid='], { encoding: 'utf8' });
  const rows: ProcRow[] = [];
  for (const line of out.split('\n')) {
    const [pid, ppid, pgid] = line.trim().split(/\s+/).map(Number);
    if (Number.isFinite(pid) && Number.isFinite(ppid) && Number.isFinite(pgid)) {
      rows.push({ pid, ppid, pgid });
    }
  }
  return rows;
}

/**
 * Every live descendant of `rootPid` (excluding the root), plus every process
 * sharing a process group with the root or a descendant.
 *
 * OpenCode starts tool shells and local MCP servers itself, and some of them
 * get their own process group, so killing only the server's group is not
 * enough. The snapshot must be taken *before* killing: once a parent dies its
 * children are re-parented to init and can no longer be found by ancestry.
 */
export function snapshotProcessTree(rootPid: number): number[] {
  if (process.platform === 'win32') {
    return [];
  }
  const rows = listProcesses();
  const children = new Map<number, number[]>();
  for (const row of rows) {
    const list = children.get(row.ppid) ?? [];
    list.push(row.pid);
    children.set(row.ppid, list);
  }

  const found = new Set<number>();
  const queue = [rootPid];
  while (queue.length > 0) {
    const pid = queue.pop()!;
    for (const child of children.get(pid) ?? []) {
      if (!found.has(child)) {
        found.add(child);
        queue.push(child);
      }
    }
  }

  const groups = new Set<number>([rootPid]);
  for (const row of rows) {
    if (found.has(row.pid)) {
      groups.add(row.pgid);
    }
  }
  for (const row of rows) {
    if (row.pid !== rootPid && groups.has(row.pgid) && row.pgid !== process.pid) {
      found.add(row.pid);
    }
  }
  found.delete(process.pid);
  return [...found];
}

export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function signalAll(pids: number[], signal: NodeJS.Signals) {
  for (const pid of pids) {
    try {
      process.kill(pid, signal);
    } catch {
      // already gone
    }
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Terminate `rootPid` and its whole tree, and resolve only once every process
 * from the pre-kill snapshot is gone (SIGTERM → grace period → SIGKILL).
 *
 * Returns the pids that were still alive after SIGKILL (normally empty).
 */
export async function killProcessTree(
  rootPid: number,
  { graceMs = 2_000, killWaitMs = 2_000 }: { graceMs?: number; killWaitMs?: number } = {},
): Promise<number[]> {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(rootPid), '/T', '/F'], { windowsHide: true });
    return [];
  }

  const tree = [rootPid, ...snapshotProcessTree(rootPid)];
  // Kill descendants and root together so nobody gets re-parented mid-shutdown
  // and escapes a later snapshot.
  signalAll(tree, 'SIGTERM');

  const waitGone = async (ms: number) => {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      if (tree.every((pid) => !isAlive(pid))) {
        return true;
      }
      await sleep(50);
    }
    return tree.every((pid) => !isAlive(pid));
  };

  if (await waitGone(graceMs)) {
    return [];
  }

  signalAll(tree.filter(isAlive), 'SIGKILL');
  await waitGone(killWaitMs);
  return tree.filter(isAlive);
}
