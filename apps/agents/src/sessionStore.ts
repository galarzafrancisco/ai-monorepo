import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

type DBEntry = {
  agentId: string;
  taskId: string;
  sessionId: string;
};

type DB = DBEntry[];

const DB_PATH = join(__dirname, "sessions.json");

function loadDB(): DB {
  if (!existsSync(DB_PATH)) return [];

  const raw = readFileSync(DB_PATH, "utf-8").trim();
  if (!raw) return []; // empty file -> empty db

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DB) : [];
  } catch {
    // If it's corrupted/partial, don't crash the whole app.
    // Optional self-heal:
    // writeFileSync(DB_PATH, "[]\n");
    return [];
  }
}

function writeDB(db: DB) {
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

export function getSession(agentId: string, taskId: string): string | null {
  const db = loadDB();
  const entry = db.find((e) => e.agentId === agentId && e.taskId === taskId);
  return entry?.sessionId ?? null;
}

export function setSession(agentId: string, taskId: string, sessionId: string) {
  const db = loadDB();
  db.push({ agentId, taskId, sessionId });
  writeDB(db);
}
