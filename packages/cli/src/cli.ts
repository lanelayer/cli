#!/usr/bin/env node
import { execSync } from "child_process";
import { cwd } from "process";
import { join } from "path";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { createHash } from "crypto";
import { handleStartCommand } from "./commands/start";
import { handleWalletCommand } from "./commands/wallet";
import { handleBurnCommand } from "./commands/burn";
import { handleExitCommand } from "./commands/exit";
import { handleUpCommand } from "./commands/up";
import { handleDownCommand } from "./commands/down";
import { handleLogsCommand } from "./commands/logs";
import { handleStatusCommand } from "./commands/status";
import { handleIntroCommand } from "./commands/intro";
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

// Removed detectProfileAndSshKey - not needed for LaneLayer

function showHelp() {
  console.log(`
🚀 lane CLI - LaneLayer Bitcoin-Anchored Execution Environment

📋 Commands:
  🆕 lane intro                           Show introduction and quick start guide
  🚀 lane start [options]                 Start Core Lane node
  💰 lane wallet <command>                 Wallet operations
    • lane wallet create                  Create a new wallet
    • lane wallet address                 Get Bitcoin address
    • lane wallet balance                 Get Bitcoin/laneBTC balance
  🔥 lane burn [options]                  Burn BTC to get laneBTC
  🚪 lane exit [options]                  Create exit intent (withdraw BTC)
  📊 lane status                          Check node status
  🐳 lane up                              Start Docker environment (bitcoin-cache + core-lane)
  🛑 lane down                            Stop Docker environment
  📄 lane logs [options]                  View container logs

💡 Quick Start:
  lane intro                              # Get started guide
  lane up                                 # Start Docker environment
  lane wallet create                      # Create a wallet
  lane wallet address                     # Get your Bitcoin address
  lane start                              # Start Core Lane node
  lane burn --amount 100000               # Burn BTC to get laneBTC

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

    case "start":
      handleStartCommand(args);
      break;

    case "wallet":
      handleWalletCommand(args);
      break;

    case "burn":
      handleBurnCommand(args);
      break;

    case "exit":
      handleExitCommand(args);
      break;

    case "status":
      handleStatusCommand(args);
      break;

    case "up":
      handleUpCommand(args);
      break;

    case "down":
      handleDownCommand(args);
      break;

    case "logs":
      handleLogsCommand(args);
      break;

    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

main();
