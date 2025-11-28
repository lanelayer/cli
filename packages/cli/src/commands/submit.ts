import { execSync } from "child_process";
import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { showCommandHelp } from "./help";
import { getComposeCacheDirectory, detectProfileAndSshKey, getPathHash } from "../cli";

interface SubmissionData {
  tx_hash?: string;
  intent_id?: string;
  user: string;
  action: string;
  params?: Record<string, any>;
  timestamp: string;
  block_height?: number;
  confirmations?: number;
}

function parseArgs(args: string[]): {
  txHash?: string;
  intentId?: string;
  user?: string;
  action?: string;
  params?: string;
  timestamp?: string;
  file?: string;
  help: boolean;
} {
  const result: {
    txHash?: string;
    intentId?: string;
    user?: string;
    action?: string;
    params?: string;
    timestamp?: string;
    file?: string;
    help: boolean;
  } = {
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--tx-hash" && i + 1 < args.length) {
      result.txHash = args[++i];
    } else if (arg === "--intent-id" && i + 1 < args.length) {
      result.intentId = args[++i];
    } else if (arg === "--user" && i + 1 < args.length) {
      result.user = args[++i];
    } else if (arg === "--action" && i + 1 < args.length) {
      result.action = args[++i];
    } else if (arg === "--params" && i + 1 < args.length) {
      result.params = args[++i];
    } else if (arg === "--timestamp" && i + 1 < args.length) {
      result.timestamp = args[++i];
    } else if (arg === "--file" && i + 1 < args.length) {
      result.file = args[++i];
    }
  }

  return result;
}

function loadSubmissionFromFile(filePath: string): SubmissionData {
  try {
    const content = readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);
    return data;
  } catch (err: any) {
    console.error(`❌ Error reading submission file: ${err.message}`);
    process.exit(1);
  }
}

function buildSubmissionFromArgs(args: {
  txHash?: string;
  intentId?: string;
  user?: string;
  action?: string;
  params?: string;
  timestamp?: string;
}): SubmissionData {
  const submission: SubmissionData = {
    user: args.user || "",
    action: args.action || "",
    timestamp: args.timestamp || new Date().toISOString(),
  };

  if (args.txHash) {
    submission.tx_hash = args.txHash;
  }

  if (args.intentId) {
    submission.intent_id = args.intentId;
  }

  if (args.params) {
    try {
      submission.params = JSON.parse(args.params);
    } catch (err: any) {
      console.error(`❌ Error parsing --params JSON: ${err.message}`);
      process.exit(1);
    }
  }

  return submission;
}

function validateSubmission(submission: SubmissionData): void {
  if (!submission.user) {
    console.error("❌ Error: --user is required");
    process.exit(1);
  }

  if (!submission.action) {
    console.error("❌ Error: --action is required");
    process.exit(1);
  }

  if (!submission.timestamp) {
    console.error("❌ Error: timestamp is required");
    process.exit(1);
  }
}

function checkContainerRunning(): boolean {
  const composePath = join(getComposeCacheDirectory(), "docker-compose.dev.json");
  if (!existsSync(composePath)) {
    return false;
  }

  try {
    const { profile } = detectProfileAndSshKey();
    const pathHash = getPathHash();
    const containerName = `${pathHash}-lane-isolated-service`;

    // Check if container is running
    const containerStatus = execSync(
      `docker ps --filter "name=${containerName}" --format "{{.Names}}"`,
      { encoding: "utf8" }
    ).trim();

    return containerStatus.length > 0;
  } catch (err) {
    return false;
  }
}

function sendSubmission(submission: SubmissionData): void {
  const jsonData = JSON.stringify(submission);
  const curlCommand = `curl -s -w "\\n%{http_code}" -X POST http://localhost:8080/submit -H "Content-Type: application/json" -d '${jsonData.replace(/'/g, "'\\''")}'`;

  try {
    const response = execSync(curlCommand, { encoding: "utf-8" });
    const lines = response.trim().split("\n");
    const httpCode = lines[lines.length - 1];
    const body = lines.slice(0, -1).join("\n");

    if (httpCode === "200") {
      console.log("✅ Submission sent successfully");
      if (body) {
        try {
          const parsed = JSON.parse(body);
          console.log(JSON.stringify(parsed, null, 2));
        } catch {
          console.log(body);
        }
      }
    } else {
      console.error(`❌ Submission failed with HTTP ${httpCode}`);
      if (body) {
        console.error(body);
      }
      process.exit(1);
    }
  } catch (err: any) {
    console.error(`❌ Error sending submission: ${err.message}`);
    if (err.stdout) {
      console.error(err.stdout);
    }
    if (err.stderr) {
      console.error(err.stderr);
    }
    process.exit(1);
  }
}

export function handleSubmitCommand(args: string[]): void {
  // Check for help flag
  if (args.includes("--help") || args.includes("-h")) {
    showCommandHelp("submit");
    return;
  }

  const parsedArgs = parseArgs(args);

  // Check if container is running
  if (!checkContainerRunning()) {
    console.error("❌ Error: Container is not running");
    console.error('Run "lane up" first to start the development environment');
    process.exit(1);
  }

  let submission: SubmissionData;

  if (parsedArgs.file) {
    // Load from file
    submission = loadSubmissionFromFile(parsedArgs.file);
  } else {
    // Build from command-line args
    submission = buildSubmissionFromArgs(parsedArgs);
  }

  // Validate required fields
  validateSubmission(submission);

  // Send submission
  console.log("📤 Sending submission to container...");
  sendSubmission(submission);
}

