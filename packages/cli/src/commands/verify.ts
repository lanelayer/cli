import { URL } from "url";
import { showCommandHelp } from "./help";

type VerifyArgs = {
  code?: string;
  session?: string;
  apiUrl: string;
  help: boolean;
};

function parseArgs(args: string[]): VerifyArgs {
  const result: VerifyArgs = {
    apiUrl: process.env.LANE_ANALYTICS_URL || "https://lanelayer-analytics.fly.dev",
    help: false,
  };

  // lane verify <code> --session <id> [--api-url <url>]
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--session" && i + 1 < args.length) {
      result.session = args[++i];
    } else if (arg === "--api-url" && i + 1 < args.length) {
      result.apiUrl = args[++i];
    } else if (!arg.startsWith("-") && !result.code) {
      result.code = arg;
    }
  }

  return result;
}

async function postJson(url: URL, body: unknown): Promise<{ status: number; text: string }> {
  const resp = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return {
    status: resp.status,
    text: await resp.text(),
  };
}

export async function handleVerifyCommand(args: string[]): Promise<void> {
  const parsed = parseArgs(args);
  if (parsed.help) {
    showCommandHelp("verify");
    return;
  }

  if (!parsed.code) {
    console.error("❌ Missing code. Usage: lane verify <6_digit_code> --session <session_id>");
    process.exit(1);
  }
  if (!parsed.session) {
    console.error("❌ Missing session. Usage: lane verify <6_digit_code> --session <session_id>");
    process.exit(1);
  }

  const base = parsed.apiUrl.replace(/\/+$/, "");
  const url = new URL(`${base}/api/v1/auth/verify`);
  url.searchParams.set("session", parsed.session);

  const resp = await postJson(url, { session_id: parsed.session, code: parsed.code });
  if (resp.status < 200 || resp.status >= 300) {
    console.error(`❌ Verify failed (HTTP ${resp.status})`);
    if (resp.text) console.error(resp.text);
    process.exit(1);
  }

  let verified = false;
  try {
    const obj = JSON.parse(resp.text || "{}");
    verified = Boolean(obj.verified);
  } catch {
    verified = false;
  }

  console.log(`Verified: ${verified ? "true" : "false"}`);
  if (!verified) {
    console.log("Code incorrect or already used. Re-check the email and try again.");
    process.exit(2);
  }
  console.log("Email confirmed. You may proceed.");
}

