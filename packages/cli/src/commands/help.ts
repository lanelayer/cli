export function showCommandHelp(command: string): void {
  switch (command) {
    case "build":
      showBuildHelp();
      break;
    case "up":
      showUpHelp();
      break;
    case "push":
      showPushHelp();
      break;
    case "create":
      showCreateHelp();
      break;
    case "export":
      showExportHelp();
      break;
    case "logs":
      showLogsHelp();
      break;
    case "exec":
      showExecHelp();
      break;
    case "shell":
      showShellHelp();
      break;
    case "cat":
      showCatHelp();
      break;
    case "prune":
      showPruneHelp();
      break;
    case "intro":
      showIntroHelp();
      break;
    case "perf":
      showPerfHelp();
      break;
    default:
      console.log(`❓ Unknown command: ${command}`);
      console.log('Use "lane --help" to see all available commands');
  }
}

function showBuildHelp(): void {
  console.log(`
🔨 lane build - Build container images
====================================

Build container images for different profiles without running them.

📋 Usage:
  lane build <profile> [options]

🎯 Profiles:
  🚀 dev          - Native platform, fastest development
  🧪 stage        - RISC-V QEMU with debug tools (⚡ ~2.3x faster than prod)
  🔒 stage-release- RISC-V QEMU without debug tools
  🔐 prod         - Verifiable RISC-V Cartesi Machine (🐢 ~2.3x slower than stage)
  🐛 prod-debug   - Verifiable RISC-V with debug tools

⚙️  Options:
  🏷️  -t, --tag <name:tag>                Custom image tag
  🖼️  --image <image>                     Use existing Docker image instead of building
  🔄 --force-rebuild                     Force rebuild all artifacts
  🏗️  --depot                             Use depot build instead of docker buildx
  🚫 --no-depot                           Disable depot build (use docker buildx)
  🚫 --no-tar-context                    Disable deterministic tar context
  🐳 --force-docker-tar                  Force using Docker for tar creation
  ⚡ --turbo                              Enable multi-core QEMU (stage profiles only)
  🤖 --guest-agent-image <image>         Custom guest agent image (prod/prod-debug only)
  🔥 --hot                               Enable hot reload (incompatible with --image)
  📁 --cache-dir <path>                  Custom cache directory

💡 Examples:
  lane build dev                          # Build for fast development
  lane build stage                        # Build for RISC-V testing
  lane build prod                         # Build verifiable RISC-V image
  lane build stage --image myapp:latest   # Use existing image
  lane build prod --guest-agent-image my-registry/guest-agent:v2
  lane build dev --hot                    # Build with hot reload support
  lane build stage --turbo                # Build with multi-core QEMU
  lane build prod --depot                 # Use depot for faster builds

🔧 Notes:
  • --image and --hot are incompatible
  • For stage/prod profiles, --image uses direct image reference in LinuxKit YAML
  • --turbo only affects stage profiles (multi-core QEMU)
  • --guest-agent-image only affects prod/prod-debug profiles
`);
}

function showUpHelp(): void {
  console.log(`
🚀 lane up - Build and run container
=====================================

Build container images and start the development environment.

📋 Usage:
  lane up <profile> [options]

🎯 Profiles:
  🚀 dev          - Native platform, fastest development
  🧪 stage        - RISC-V QEMU with debug tools (⚡ ~2.3x faster than prod)
  🔒 stage-release- RISC-V QEMU without debug tools
  🔐 prod         - Verifiable RISC-V Cartesi Machine (🐢 ~2.3x slower than stage)
  🐛 prod-debug   - Verifiable RISC-V with debug tools

⚙️  Options:
  🏷️  -t, --tag <name:tag>                Custom image tag
  🖼️  --image <image>                     Use existing Docker image instead of building
  🔄 --force-rebuild                     Force rebuild all artifacts
  🔄 --restart                           Force restart environment
  🏗️  --depot                             Use depot build instead of docker buildx
  🚫 --no-depot                           Disable depot build (use docker buildx)
  🚫 --no-tar-context                    Disable deterministic tar context
  🐳 --force-docker-tar                  Force using Docker for tar creation
  ⚡ --turbo                              Enable multi-core QEMU (stage profiles only)
  🤖 --guest-agent-image <image>         Custom guest agent image (prod/prod-debug only)
  🔥 --hot                               Enable hot reload (incompatible with --image)
  📁 --cache-dir <path>                  Custom cache directory

💡 Examples:
  lane up dev                             # Build and run (fastest)
  lane up stage                           # Build and run (RISC-V testing)
  lane up prod                            # Build and run (verifiable)
  lane up stage --image myapp:latest      # Use existing image
  lane up prod --guest-agent-image my-registry/guest-agent:v2
  lane up dev --hot                       # Hot reload (file watching)
  lane up stage --hot                     # Hot reload (rebuild on changes)
  lane up stage --turbo                   # Multi-core QEMU for faster emulation
  lane up dev --restart                   # Force restart environment

🔧 Notes:
  • --image and --hot are incompatible
  • For stage/prod profiles, --image uses direct image reference in LinuxKit YAML
  • --turbo only affects stage profiles (multi-core QEMU)
  • --guest-agent-image only affects prod/prod-debug profiles
  • Hot reload behavior varies by profile (file watching vs rebuild)
`);
}

function showPushHelp(): void {
  console.log(`
📤 lane push - Build and push to registry
========================================

Build a production (RISC-V) container and push it to a registry.

📋 Usage:
  lane push <registry-path> [options]

⚙️  Options:
  📁 --cache-dir <path>                  Custom cache directory
  🔄 --force-rebuild                     Force rebuild all artifacts
  🏗️  --depot                             Use depot build instead of docker buildx
  🚫 --no-depot                           Disable depot build (use docker buildx)
  🐳 --force-docker-tar                  Force using Docker for tar creation
  📦 --source                             Only push source context, don't build
  🔗 --git                                Only push to git remote, don't build

💡 Examples:
  lane push my-registry.com/myapp:latest
  lane push ghcr.io/myuser/myapp:v1.0.0
  lane push docker.io/myuser/myapp:latest
  lane push my-registry.com/myapp:latest --depot
  lane push my-registry.com/myapp:latest --force-rebuild

🔧 Notes:
  • Always builds for RISC-V 64-bit architecture
  • Uses deterministic builds for reproducibility
  • Supports custom registry mappings
  • --source and --git are mutually exclusive
`);
}

function showCreateHelp(): void {
  console.log(`
🏗️  lane create - Create new HTTP server project
=================================================

Create a new HTTP server project from a template.

📋 Usage:
  lane create <project-name> --template <language>

🎯 Templates:
  🐍 python     - Python HTTP server
  🟨 node       - Node.js HTTP server
  🦀 rust       - Rust HTTP server
  🐹 go         - Go HTTP server

💡 Examples:
  lane create myapp --template python
  lane create webapp --template node
  lane create cli-tool --template rust
  lane create api-server --template go

🔧 Notes:
  • Creates a new directory with the project name
  • Includes Dockerfile and basic HTTP server structure
  • Ready to run with "lane up" immediately
  • Your server should expose a /health endpoint
`);
}

function showExportHelp(): void {
  console.log(`
📦 lane export - Export profile artifacts
========================================

Export build artifacts for a specific profile to a directory.

📋 Usage:
  lane export <profile> <path> [options]

🎯 Profiles:
  🚀 dev          - Native platform artifacts
  🧪 stage        - RISC-V QEMU artifacts
  🔒 stage-release- RISC-V QEMU artifacts (no debug)
  🔐 prod         - Verifiable RISC-V artifacts
  🐛 prod-debug   - Verifiable RISC-V artifacts (with debug)

⚙️  Options:
  🤖 --guest-agent-image <image>         Custom guest agent image (prod/prod-debug only)
  📁 --cache-dir <path>                  Custom cache directory
  🔄 --force-rebuild                     Force rebuild all artifacts

💡 Examples:
  lane export prod ./deployment
  lane export stage ./test-artifacts
  lane export prod ./deployment --guest-agent-image my-registry/guest-agent:v2
  lane export prod ./deployment --force-rebuild

🔧 Notes:
  • Exports all artifacts needed for deployment
  • For prod profiles, includes Cartesi machine snapshots
  • --guest-agent-image only affects prod/prod-debug profiles
`);
}

function showDownHelp(): void {
  console.log(`
🛑 lane down - Stop development environment
===========================================

Stop the development environment.

📋 Usage:
  lane down

💡 What it does:
  • Stops the running container
  • Preserves data volumes
  • Can be restarted with 'lane up'

🔧 Notes:
  • Stops the container for the current project
`);
}

function showLogsHelp(): void {
  console.log(`
📄 lane logs - View container logs
===================================

View logs from containers or system components.

📋 Usage:
  lane logs [options]

⚙️  Options:
  💻 --system                            Target system instead of container
  📺 -f, --follow                        Follow logs in real-time
  📊 --tail <lines>                      Show last N lines (default: 100)

💡 Examples:
  lane logs                               # View application logs
  lane logs --follow                      # Follow logs in real-time
  lane logs --system                      # View system logs
  lane logs --system --follow             # Follow system logs
  lane logs --tail 50                     # Show last 50 lines

🔧 Notes:
  • Default shows application container logs
  • --system shows LaneLayer system component logs
  • --follow continues showing new log entries
`);
}

function showExecHelp(): void {
  console.log(`
⚡ lane exec - Execute command in container
==========================================

Execute a command in the running container or system.

📋 Usage:
  lane exec [options] <command>

⚙️  Options:
  💻 --system                            Target system instead of container

💡 Examples:
  lane exec "ls -la"                      # List files in container
  lane exec "ps aux"                      # Show processes in container
  lane exec --system "ls -la"             # List files in system
  lane exec "cat /etc/os-release"         # Show OS info in container

🔧 Notes:
  • Default executes in application container
  • --system executes in LaneLayer system environment
  • Command must be quoted if it contains spaces
`);
}

function showShellHelp(): void {
  console.log(`
🐚 lane shell - Open interactive shell
=====================================

Open an interactive shell in the container or system.

📋 Usage:
  lane shell [options]

⚙️  Options:
  💻 --system                            Target system instead of container

💡 Examples:
  lane shell                              # Open shell in container
  lane shell --system                     # Open shell in system

🔧 Notes:
  • Default opens shell in application container
  • --system opens shell in LaneLayer system environment
  • Interactive shell for debugging and exploration
`);
}

function showCatHelp(): void {
  console.log(`
📖 lane cat - View file contents
===============================

View the contents of a file in the container or system.

📋 Usage:
  lane cat <file-path> [options]

⚙️  Options:
  💻 --system                            Target system instead of container

💡 Examples:
  lane cat /etc/os-release                # View OS info in container
  lane cat /app/main.py                   # View application file
  lane cat --system /etc/hosts            # View system hosts file

🔧 Notes:
  • Default reads from application container
  • --system reads from LaneLayer system environment
  • Useful for debugging and file inspection
`);
}

function showPruneHelp(): void {
  console.log(`
🧹 lane prune - Clean up LaneLayer environment
=============================================

Clean up LaneLayer containers, images, and cache data.

📋 Usage:
  lane prune [options]

⚙️  Options:
  🏠 --local                             Only clean up local project data

💡 Examples:
  lane prune                              # Clean up all LaneLayer data
  lane prune --local                      # Clean up only current project

🔧 Notes:
  • --local only removes data for current project
  • Without --local, removes all LaneLayer data globally
  • Removes containers, images, and cache directories
  • Use with caution as this cannot be undone
`);
}

function showPerfHelp(): void {
  console.log(`
🎼 lane perf - Run Linux perf tool in stage/prod-debug
====================================================

Run the Linux perf tool inside the system VM for performance analysis.

📋 Usage:
  lane perf <subcommand> [args]

🔧 Supported subcommands:
  record    - Start a perf recording
  top       - Show live profiling
  report    - Analyze perf data

🎯 Profiles:
  🧪 stage        - Uses QEMU, runs: /proc/1/root/usr/bin/perf-cm-riscv64 <subcommand> [args]
  🐛 prod-debug   - Uses Cartesi Machine, runs: /proc/1/root/usr/bin/perf-cm-riscv64 <subcommand> [args]

⚙️  Behavior:
  • record:   stage → 'record', prod-debug → 'record -e cpu-clock -F max'
  • top:      stage → 'top',    prod-debug → 'top -e cpu-clock -F max'
  • report:   Both → 'report' (plus any extra args)

💡 Examples:
  lane perf record
  lane perf top
  lane perf report -i perf.data

🔒 Only available for stage and prod-debug profiles.
`);
}

function showIntroHelp(): void {
  console.log(`
🆕 lane intro - Introduction and quick start
============================================

Show introduction and quick start guide for LaneLayer.

📋 Usage:
  lane intro

💡 What you'll learn:
  • What LaneLayer is and how it works
  • Quick start workflow for HTTP server development
  • Profile guide and when to use each
  • Common commands and examples
  • Pro tips for effective development

🔧 Notes:
  • Perfect for new users
  • Shows complete workflow from creation to deployment
  • Includes examples for all major use cases
`);
}
