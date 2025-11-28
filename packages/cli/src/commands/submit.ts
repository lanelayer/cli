import { execSync } from "child_process";
import { join } from "path";
import { existsSync, readFileSync } from "fs";
import http from "http";
import { showCommandHelp } from "./help";
import { getComposeCacheDirectory, getPathHash } from "../cli";

function parseArgs(args: string[]): {
  data?: string;
  file?: string;
  stdin: boolean;
  headers: Array<{ name: string; value: string }>;
  help: boolean;
} {
  const result: {
    data?: string;
    file?: string;
    stdin: boolean;
    headers: Array<{ name: string; value: string }>;
    help: boolean;
  } = {
    stdin: false,
    headers: [],
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--data" && i + 1 < args.length) {
      result.data = args[++i];
    } else if (arg === "--file" && i + 1 < args.length) {
      result.file = args[++i];
    } else if (arg === "--stdin") {
      result.stdin = true;
    } else if (arg === "--header" && i + 1 < args.length) {
      const headerStr = args[++i];
      const colonIndex = headerStr.indexOf(":");
      if (colonIndex > 0) {
        const name = headerStr.substring(0, colonIndex).trim();
        const value = headerStr.substring(colonIndex + 1).trim();
        result.headers.push({ name, value });
      } else {
        console.error(`❌ Error: Invalid header format: ${headerStr}`);
        console.error('Header must be in format "Name: Value"');
        process.exit(1);
      }
    }
  }

  return result;
}

function readStdin(): Buffer {
  try {
    // Check if stdin is a TTY (interactive terminal)
    if (process.stdin.isTTY) {
      console.error("❌ Error: No data provided via stdin");
      console.error(
        "Use --data, --file, or pipe data: echo 'data' | lane submit --stdin"
      );
      process.exit(1);
    }

    // Read from stdin file descriptor (0)
    // This works when data is piped: echo "data" | lane submit --stdin
    return readFileSync(0);
  } catch (err: any) {
    console.error(`❌ Error reading from stdin: ${err.message}`);
    process.exit(1);
  }
}

function loadDataFromFile(filePath: string): Buffer {
  try {
    return readFileSync(filePath);
  } catch (err: any) {
    console.error(`❌ Error reading file: ${err.message}`);
    process.exit(1);
  }
}

function checkContainerRunning(): boolean {
  const composePath = join(
    getComposeCacheDirectory(),
    "docker-compose.dev.json"
  );
  if (!existsSync(composePath)) {
    return false;
  }

  try {
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

function sendSubmission(
  data: Buffer,
  headers: Array<{ name: string; value: string }>
): void {
  const httpHeaders: Record<string, string> = {
    "Content-Type": "application/octet-stream",
    "Content-Length": data.length.toString(),
  };

  // Add custom headers
  for (const header of headers) {
    httpHeaders[header.name] = header.value;
  }

  const options = {
    hostname: "localhost",
    port: 8080,
    path: "/submit",
    method: "POST",
    headers: httpHeaders,
  };

  const req = http.request(options, (res) => {
    let body = "";
    res.on("data", (chunk) => (body += chunk));
    res.on("end", () => {
      if (res.statusCode === 200) {
        console.log("✅ Submission sent successfully");
        if (body) {
          try {
            console.log(JSON.stringify(JSON.parse(body), null, 2));
          } catch {
            console.log(body);
          }
        }
      } else {
        console.error(`❌ Submission failed with HTTP ${res.statusCode}`);
        if (body) {
          console.error(body);
        }
        process.exit(1);
      }
    });
  });

  req.on("error", (err) => {
    console.error(`❌ Error sending submission: ${err.message}`);
    process.exit(1);
  });

  req.write(data);
  req.end();
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

  // Determine data source
  let data: Buffer;

  if (parsedArgs.stdin) {
    data = readStdin();
  } else if (parsedArgs.file) {
    data = loadDataFromFile(parsedArgs.file);
  } else if (parsedArgs.data) {
    data = Buffer.from(parsedArgs.data, "utf-8");
  } else {
    console.error("❌ Error: No data source specified");
    console.error("Use --data <string>, --file <path>, or --stdin");
    process.exit(1);
  }

  if (data.length === 0) {
    console.error("❌ Error: No data to send");
    process.exit(1);
  }

  // Send submission
  console.log(`📤 Sending ${data.length} bytes to container...`);
  sendSubmission(data, parsedArgs.headers);
}
