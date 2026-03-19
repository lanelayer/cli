import https from "https";
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

function postJson(url: URL, body: unknown): Promise<{ status: number; text: string }> {
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method: "POST",
        hostname: url.hostname,
        port: url.port ? Number(url.port) : 443,
        path: url.pathname + url.search,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload).toString(),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (d) => chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));
        res.on("end", () => {
          resolve({
            status: res.statusCode || 0,
            text: Buffer.concat(chunks).toString("utf8"),
          });
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
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

