#!/usr/bin/env node
import { execSync } from "child_process";
import { cwd } from "process";
import { join } from "path";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { createHash } from "crypto";
import { handleBuildCommand, handleUpCommand } from "./commands/build";
import {
  handleLogsCommand,
  handleExecCommand,
  handleShellCommand,
  handleCatCommand,
  handlePerfCommand,
} from "./commands/container";
import { pruneLaneLocal, pruneLane } from "./commands/prune";
import { handleCreateCommand } from "./commands/create";
import { handleExportCommand } from "./commands/export";
import { handleIntroCommand } from "./commands/intro";
import { handlePushCommand } from "./commands/push";
import { handleDownCommand } from "./commands/down";
import { showCommandHelp } from "./commands/help";
import { checkDockerAvailable } from "./checks";

export function getPathHash(): string {
  const currentPath = cwd();
  return createHash("sha256").update(currentPath).digest("hex").substring(0, 8);
}

export function getComposeCacheDirectory(): string {
  const pathHash = getPathHash();
  const composeCacheDir = join(homedir(), ".cache", "lane", pathHash);

  // Create compose cache directory if it doesn't exist
  if (!existsSync(composeCacheDir)) {
    mkdirSync(composeCacheDir, { recursive: true });
  }

  return composeCacheDir;
}

export function detectProfileAndSshKey(): {
  profile: "dev" | "stage" | "stage-release" | "prod" | "prod-debug";
  sshKeyPath?: string;
} {
  const pathHash = getPathHash();
  const containerName = `${pathHash}-lane-isolated-service`;

  try {
    // Get the profile label from the container
    const profileLabel = execSync(
      `docker inspect ${containerName} --format '{{ index .Config.Labels "lane.profile" }}'`,
      { encoding: "utf8" }
    ).trim();
    if (
      profileLabel === "stage" ||
      profileLabel === "stage-release" ||
      profileLabel === "prod" ||
      profileLabel === "prod-debug"
    ) {
      // Only debug profiles have SSH key
      const sshKeyPath =
        profileLabel === "stage" || profileLabel === "prod-debug"
          ? "/work/ssh.debug-key"
          : undefined;
      return { profile: profileLabel as any, sshKeyPath };
    } else {
      return { profile: "dev" };
    }
  } catch (err) {
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
  checkDockerAvailable();

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
      handleIntroCommand(args);
      break;

    case "build":
      handleBuildCommand(args);
      break;

    case "up":
      handleUpCommand(args);
      break;

    case "push":
      handlePushCommand(args);
      break;

    case "down":
      handleDownCommand(args);
      break;

    case "logs":
      handleLogsCommand(args);
      break;

    case "exec":
      handleExecCommand(args);
      break;

    case "shell":
      handleShellCommand(args);
      break;

    case "cat":
      handleCatCommand(args);
      break;

    case "export":
      handleExportCommand(args);
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
        pruneLaneLocal();
      } else {
        pruneLane();
      }
      break;

    case "create":
      handleCreateCommand(args);
      break;

    case "perf":
      handlePerfCommand(args);
      break;

    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

main();
