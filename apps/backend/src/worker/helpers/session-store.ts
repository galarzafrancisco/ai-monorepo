import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';

type SessionRecord = {
  agentActorId: string;
  taskId: string;
  sessionId: string;
};

const SESSION_STORE_PATH = join(os.homedir(), '.taico', 'worker-sessions.json');

function loadStore(): SessionRecord[] {
  if (!existsSync(SESSION_STORE_PATH)) {
    return [];
  }

  const raw = readFileSync(SESSION_STORE_PATH, 'utf8').trim();
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SessionRecord[]) : [];
  } catch {
    return [];
  }
}

function saveStore(records: SessionRecord[]): void {
  mkdirSync(join(os.homedir(), '.taico'), { recursive: true });
  writeFileSync(SESSION_STORE_PATH, JSON.stringify(records, null, 2));
}

export function getSession(agentActorId: string, taskId: string): string | null {
  const record = loadStore().find(
    (item) => item.agentActorId === agentActorId && item.taskId === taskId,
  );
  return record?.sessionId ?? null;
}

export function setSession(
  agentActorId: string,
  taskId: string,
  sessionId: string,
): void {
  const records = loadStore();
  const existingRecord = records.find(
    (item) => item.agentActorId === agentActorId && item.taskId === taskId,
  );

  if (existingRecord) {
    existingRecord.sessionId = sessionId;
  } else {
    records.push({ agentActorId, taskId, sessionId });
  }

  saveStore(records);
}
