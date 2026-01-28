import { homedir } from "os";
import { join } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { randomUUID } from "crypto";

const CONFIG_DIR = join(homedir(), ".lane");
const CONFIG_FILE = join(CONFIG_DIR, "analytics.json");
const API_BASE =
  process.env.LANE_TELEMETRY_ENDPOINT || "https://helper.lanelayer.com";
const CLI_VERSION = "0.4.9";

interface AnalyticsConfig {
  user_id: string;
  telemetry: boolean;
  created_at: string;
}

function getOrCreateConfig(): AnalyticsConfig {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }

  if (existsSync(CONFIG_FILE)) {
    try {
      return JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
    } catch {
      // Corrupted file, recreate
    }
  }

  const config: AnalyticsConfig = {
    user_id: `cli_${randomUUID()}`,
    telemetry: true,
    created_at: new Date().toISOString(),
  };

  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  return config;
}

export function trackCommand(
  command: string,
  options?: {
    profile?: string;
    success?: boolean;
    duration_ms?: number;
    error_message?: string;
    session_id?: string;
  }
): void {
  const config = getOrCreateConfig();
  if (!config.telemetry) return;

  const payload = {
    user_id: config.user_id,
    command,
    profile: options?.profile,
    success: options?.success,
    duration_ms: options?.duration_ms,
    error_message: options?.error_message,
    session_id: options?.session_id,
    cli_version: CLI_VERSION,
    os: process.platform,
  };

  // Non-blocking fire-and-forget
  fetch(`${API_BASE}/api/v1/events/cli`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5000),
  }).catch(() => {
    // Silently fail - never break CLI for telemetry
  });
}

export function disableTelemetry(): void {
  const config = getOrCreateConfig();
  config.telemetry = false;
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  console.log("Telemetry disabled.");
}

export function enableTelemetry(): void {
  const config = getOrCreateConfig();
  config.telemetry = true;
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  console.log("Telemetry enabled.");
}
