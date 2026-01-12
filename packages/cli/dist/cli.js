#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPathHash = getPathHash;
exports.getComposeCacheDirectory = getComposeCacheDirectory;
exports.detectProfileAndSshKey = detectProfileAndSshKey;
const child_process_1 = require("child_process");
const process_1 = require("process");
const path_1 = require("path");
const fs_1 = require("fs");
const os_1 = require("os");
const crypto_1 = require("crypto");
const build_1 = require("./commands/build");
const container_1 = require("./commands/container");
const prune_1 = require("./commands/prune");
const create_1 = require("./commands/create");
const export_1 = require("./commands/export");
const intro_1 = require("./commands/intro");
const push_1 = require("./commands/push");
const down_1 = require("./commands/down");
const submit_1 = require("./commands/submit");
const checks_1 = require("./checks");
function getPathHash() {
    const currentPath = (0, process_1.cwd)();
    return (0, crypto_1.createHash)("sha256").update(currentPath).digest("hex").substring(0, 8);
}
function getComposeCacheDirectory() {
    const pathHash = getPathHash();
    const composeCacheDir = (0, path_1.join)((0, os_1.homedir)(), ".cache", "lane", pathHash);
    // Create compose cache directory if it doesn't exist
    if (!(0, fs_1.existsSync)(composeCacheDir)) {
        (0, fs_1.mkdirSync)(composeCacheDir, { recursive: true });
    }
    return composeCacheDir;
}
function detectProfileAndSshKey() {
    const pathHash = getPathHash();
    const containerName = `${pathHash}-lane-isolated-service`;
    try {
        // Get the profile label from the container
        const profileLabel = (0, child_process_1.execSync)(`docker inspect ${containerName} --format '{{ index .Config.Labels "lane.profile" }}'`, { encoding: "utf8" }).trim();
        if (profileLabel === "stage" ||
            profileLabel === "stage-release" ||
            profileLabel === "prod" ||
            profileLabel === "prod-debug") {
            // Only debug profiles have SSH key
            const sshKeyPath = profileLabel === "stage" || profileLabel === "prod-debug"
                ? "/work/ssh.debug-key"
                : undefined;
            return { profile: profileLabel, sshKeyPath };
        }
        else {
            return { profile: "dev" };
        }
    }
    catch (err) {
        // Fallback to dev profile if we can't inspect the container
        return { profile: "dev" };
    }
}
function showHelp() {
    console.log(`
🚀 lane CLI - Container Development Platform

Build and run HTTP server containers for payments and intent execution.

📋 Commands:
  🆕 lane intro                           Show introduction and quick start guide
  🏗️  lane create <dir> --template <lang>  Create new HTTP server project
  🔨 lane build <profile> [options]       Build container images
  🚀 lane up <profile> [options]          Build and run container
  📤 lane push <registry-path> [options]  Build and push container to registry
  🛑 lane down                            Stop development environment
  📄 lane logs [options]                  View container logs
  📤 lane submit [options]                Send test submission to container (dev only)
  ⚡ lane exec [options] <command>        Execute command in container
  🐚 lane shell [options]                 Open shell in container
  📖 lane cat <file-path>                 View file contents in container
  📦 lane export <profile> <path> [options]  Export profile artifacts to directory
  🧹 lane prune [--local]                 Clean up LaneLayer environment
  🎼 lane perf <subcommand> [args]        Run Linux perf tool in stage/prod-debug

🎯 Profiles:
  🚀 dev          - Fastest development (native platform)
  🧪 stage        - Testing environment with debug tools (⚡ ~2.3x faster than prod)
  🔒 stage-release- Testing environment without debug tools
  🔐 prod         - Production-ready verifiable environment (🐢 ~2.3x slower than stage)
  🐛 prod-debug   - Production environment with debug tools

💡 Quick Start:
  lane intro                              # Get started guide
  lane create myapp --template python     # New HTTP server project
  lane up dev                             # Build and run (fastest)
  lane up stage                           # Build and run (testing environment)
  lane up prod                            # Build and run (production-ready)

📚 For detailed help: lane <command> --help
`);
}
// Removed createBuildKitConfig - not needed for LaneLayer
function main() {
    (0, checks_1.checkDockerAvailable)();
    const args = process.argv.slice(2);
    if (args.length === 0) {
        showHelp();
        return;
    }
    // Check for help flags (only if first argument)
    if (args[0] === "--help" || args[0] === "-h") {
        showHelp();
        return;
    }
    const command = args[0];
    switch (command) {
        case "intro":
            (0, intro_1.handleIntroCommand)(args);
            break;
        case "build":
            (0, build_1.handleBuildCommand)(args);
            break;
        case "up":
            (0, build_1.handleUpCommand)(args);
            break;
        case "push":
            (0, push_1.handlePushCommand)(args);
            break;
        case "down":
            (0, down_1.handleDownCommand)(args);
            break;
        case "logs":
            (0, container_1.handleLogsCommand)(args);
            break;
        case "exec":
            (0, container_1.handleExecCommand)(args);
            break;
        case "shell":
            (0, container_1.handleShellCommand)(args);
            break;
        case "cat":
            (0, container_1.handleCatCommand)(args);
            break;
        case "export":
            (0, export_1.handleExportCommand)(args);
            break;
        case "prune":
            let pruneLocal = false;
            // Parse prune arguments
            for (let i = 1; i < args.length; i++) {
                const arg = args[i];
                if (arg === "--local") {
                    pruneLocal = true;
                }
            }
            if (pruneLocal) {
                (0, prune_1.pruneLaneLocal)();
            }
            else {
                (0, prune_1.pruneLane)();
            }
            break;
        case "create":
            (0, create_1.handleCreateCommand)(args);
            break;
        case "perf":
            (0, container_1.handlePerfCommand)(args);
            break;
        case "submit":
            (0, submit_1.handleSubmitCommand)(args);
            break;
        default:
            console.error(`Unknown command: ${command}`);
            showHelp();
            process.exit(1);
    }
}
main();
