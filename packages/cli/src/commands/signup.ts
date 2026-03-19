import { URL } from "url";
import { showCommandHelp } from "./help";

type SignupArgs = {
  email?: string;
  session?: string;
  apiUrl: string;
  help: boolean;
};

function parseArgs(args: string[]): SignupArgs {
  const result: SignupArgs = {
    apiUrl: process.env.LANE_ANALYTICS_URL || "https://lanelayer-analytics.fly.dev",
    help: false,
  };

  // lane signup <email> --session <id> [--api-url <url>]
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--session" && i + 1 < args.length) {
      result.session = args[++i];
    } else if (arg === "--api-url" && i + 1 < args.length) {
      result.apiUrl = args[++i];
    } else if (!arg.startsWith("-") && !result.email) {
      result.email = arg;
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

export async function handleSignupCommand(args: string[]): Promise<void> {
  const parsed = parseArgs(args);
  if (parsed.help) {
    showCommandHelp("signup");
    return;
  }

  if (!parsed.email) {
    console.error("❌ Missing email. Usage: lane signup <email> --session <session_id>");
    process.exit(1);
  }
  if (!parsed.session) {
    console.error("❌ Missing session. Usage: lane signup <email> --session <session_id>");
    process.exit(1);
  }

  const base = parsed.apiUrl.replace(/\/+$/, "");
  const url = new URL(`${base}/api/v1/auth/register`);
  url.searchParams.set("session", parsed.session);

  console.log(`Registering ${parsed.email} for session ${parsed.session}...`);
  const resp = await postJson(url, { email: parsed.email, session_id: parsed.session });

  if (resp.status < 200 || resp.status >= 300) {
    console.error(`❌ Signup failed (HTTP ${resp.status})`);
    if (resp.text) console.error(resp.text);
    process.exit(1);
  }

  console.log("Verification code sent. Check your inbox for a 6-digit code.");
  console.log(`Next: lane verify <code> --session ${parsed.session}`);
}

