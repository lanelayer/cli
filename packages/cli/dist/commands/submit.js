"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSubmitCommand = handleSubmitCommand;
const child_process_1 = require("child_process");
const path_1 = require("path");
const fs_1 = require("fs");
const http_1 = __importDefault(require("http"));
const help_1 = require("./help");
const cli_1 = require("../cli");
function parseArgs(args) {
    const result = {
        stdin: false,
        headers: [],
        help: false,
    };
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--help" || arg === "-h") {
            result.help = true;
        }
        else if (arg === "--data" && i + 1 < args.length) {
            result.data = args[++i];
        }
        else if (arg === "--file" && i + 1 < args.length) {
            result.file = args[++i];
        }
        else if (arg === "--stdin") {
            result.stdin = true;
        }
        else if (arg === "--header" && i + 1 < args.length) {
            const headerStr = args[++i];
            const colonIndex = headerStr.indexOf(":");
            if (colonIndex > 0) {
                const name = headerStr.substring(0, colonIndex).trim();
                const value = headerStr.substring(colonIndex + 1).trim();
                result.headers.push({ name, value });
            }
            else {
                console.error(`❌ Error: Invalid header format: ${headerStr}`);
                console.error('Header must be in format "Name: Value"');
                process.exit(1);
            }
        }
    }
    return result;
}
function readStdin() {
    try {
        // Check if stdin is a TTY (interactive terminal)
        if (process.stdin.isTTY) {
            console.error("❌ Error: No data provided via stdin");
            console.error("Use --data, --file, or pipe data: echo 'data' | lane submit --stdin");
            process.exit(1);
        }
        // Read from stdin file descriptor (0)
        // This works when data is piped: echo "data" | lane submit --stdin
        return (0, fs_1.readFileSync)(0);
    }
    catch (err) {
        console.error(`❌ Error reading from stdin: ${err.message}`);
        process.exit(1);
    }
}
function loadDataFromFile(filePath) {
    try {
        return (0, fs_1.readFileSync)(filePath);
    }
    catch (err) {
        console.error(`❌ Error reading file: ${err.message}`);
        process.exit(1);
    }
}
function checkContainerRunning() {
    const composePath = (0, path_1.join)((0, cli_1.getComposeCacheDirectory)(), "docker-compose.dev.json");
    if (!(0, fs_1.existsSync)(composePath)) {
        return false;
    }
    try {
        const pathHash = (0, cli_1.getPathHash)();
        const containerName = `${pathHash}-lane-isolated-service`;
        // Check if container is running
        const containerStatus = (0, child_process_1.execSync)(`docker ps --filter "name=${containerName}" --format "{{.Names}}"`, { encoding: "utf8" }).trim();
        return containerStatus.length > 0;
    }
    catch (err) {
        return false;
    }
}
function sendSubmission(data, headers) {
    const httpHeaders = {
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
    const req = http_1.default.request(options, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
            if (res.statusCode === 200) {
                console.log("✅ Submission sent successfully");
                if (body) {
                    try {
                        console.log(JSON.stringify(JSON.parse(body), null, 2));
                    }
                    catch {
                        console.log(body);
                    }
                }
            }
            else {
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
function handleSubmitCommand(args) {
    // Check for help flag
    if (args.includes("--help") || args.includes("-h")) {
        (0, help_1.showCommandHelp)("submit");
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
    let data;
    if (parsedArgs.stdin) {
        data = readStdin();
    }
    else if (parsedArgs.file) {
        data = loadDataFromFile(parsedArgs.file);
    }
    else if (parsedArgs.data) {
        data = Buffer.from(parsedArgs.data, "utf-8");
    }
    else {
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
