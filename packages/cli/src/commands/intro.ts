import { execSync } from "child_process";
import { showCommandHelp } from "./help";

export function handleIntroCommand(args: string[]): void {
  // Check for help flag
  if (args.includes("--help") || args.includes("-h")) {
    showCommandHelp("intro");
    return;
  }

  console.log(`
🚀 LaneLayer CLI - Bitcoin-Anchored Execution Environment
=========================================================

LaneLayer is a coordination layer for intent-driven execution, anchored in Bitcoin.
It lets you execute trustless intents, swaps, lending, and payments without locking BTC.

📋 Quick Start Workflow
=======================

1. Start the Docker environment:
   lane up

2. Create a wallet:
   lane wallet create

3. Get your Bitcoin address:
   lane wallet address

4. Start the Core Lane node:
   lane start

5. Burn BTC to get laneBTC:
   lane burn --amount 100000 --eth-address YOUR_ETH_ADDRESS

6. Create exit intent (withdraw BTC):
   lane exit --bitcoin-address YOUR_BTC_ADDRESS --amount 50000000

💡 Key Concepts
===============

• Bitcoin Anchored - All activity settles to Bitcoin, no locked BTC
• Intent-Driven - Express what you want, not how to do it
• Trustless - No need for centralized exchanges or risky bridges
• Miner Fees - Usage increases Bitcoin transaction fees for miners

🔧 Common Commands
==================

lane up                              # Start Docker environment
lane down                            # Stop Docker environment
lane wallet create                   # Create a new wallet
lane wallet address                  # Get Bitcoin address
lane wallet balance                  # Get balance
lane start                           # Start Core Lane node
lane burn                            # Burn BTC to get laneBTC
lane exit                            # Create exit intent
lane status                          # Check node status
lane logs                            # View logs

📚 Need More Help?
==================

lane --help                          # Full command reference
lane <command> --help                # Command-specific help

Learn more: https://lanelayer.github.io
`);
}
