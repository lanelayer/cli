import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

type AuthStore = Record<string, { token: string; updatedAt: string }>;

function getStoreDir(): string {
  return join(homedir(), ".config", "lane");
}

function getStorePath(): string {
  return join(getStoreDir(), "auth.json");
}

function getLegacyStorePath(): string {
  return join(homedir(), ".lane", "auth.json");
}

function ensureStoreMigrated(): void {
  const newPath = getStorePath();
  if (existsSync(newPath)) return;

  const legacyPath = getLegacyStorePath();
  if (!existsSync(legacyPath)) return;

  const dir = getStoreDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  copyFileSync(legacyPath, newPath);
}

function loadStore(): AuthStore {
  ensureStoreMigrated();
  const path = getStorePath();
  if (!existsSync(path)) return {};
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as AuthStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveStore(store: AuthStore): void {
  const dir = getStoreDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(getStorePath(), `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function makeKey(apiUrl: string, sessionId: string): string {
  return `${apiUrl.replace(/\/+$/, "")}::${sessionId}`;
}

export function saveAuthToken(
  apiUrl: string,
  sessionId: string,
  token: string
): string {
  const store = loadStore();
  const key = makeKey(apiUrl, sessionId);
  store[key] = { token, updatedAt: new Date().toISOString() };
  saveStore(store);
  return getStorePath();
}

export function readAuthToken(
  apiUrl: string,
  sessionId: string
): string | undefined {
  const store = loadStore();
  const key = makeKey(apiUrl, sessionId);
  return store[key]?.token;
}

