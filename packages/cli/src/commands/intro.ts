import { execSync } from "child_process";
import { showCommandHelp } from "./help";

export function handleIntroCommand(args: string[]): void {
  // Check for help flag
  if (args.includes("--help") || args.includes("-h")) {
    showCommandHelp("intro");
    return;
  }

  console.log(`
🚀 LaneLayer CLI - Container Development Platform
==================================================

Build HTTP server containers that handle payments and execute user intents.
LaneLayer handles the complexity behind the scenes - you just write standard HTTP servers.

📋 Quick Start Workflow
=======================

1. Create a new HTTP server project:
   lane create myapp --template python

2. Build and run (choose your profile):
   lane up dev          # Fast development (recommended to start)
   lane up stage        # Testing environment with debug tools
   lane up prod         # Production-ready verifiable environment

3. Interact with your app:
   lane logs            # View application logs
   lane exec "ls -la"   # Run commands in container
   lane shell           # Open interactive shell

4. Stop when done:
   lane down

🎯 Profile Guide
================

dev          - Fastest development (native platform)
stage        - Testing environment with debug tools (SSH access)
stage-release- Testing environment without debug tools
prod         - Production-ready verifiable environment
prod-debug   - Production environment with debug tools

💡 Pro Tips
===========

• Start with 'dev' for fast iteration
• Use 'stage' to test your application in a production-like environment
• Use 'prod' for production-ready builds
• SSH keys are auto-generated for debug profiles
• All builds (based on same built Docker image) are deterministic and reproducible
• Your HTTP server should expose a /health endpoint

🔧 Common Commands
==================

lane create <name> --template <lang>  # New HTTP server project
lane up <profile>                     # Build and run
lane down                             # Stop environment
lane logs                             # View logs
lane exec <command>                   # Run command
lane export <profile> <path>          # Export artifacts
lane push <registry>                  # Push to registry

📚 Need More Help?
==================

lane --help                           # Full command reference
lane <command> --help                 # Command-specific help

Happy building! 🐳
`);
}
