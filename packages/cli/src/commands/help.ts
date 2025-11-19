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

function showStartHelp(): void {
  console.log(`
🚀 lane start - Start Core Lane node
=====================================

Start the Core Lane node to process Bitcoin blocks and execute intents.

📋 Usage:
  lane start [options]

⚙️  Options:
  🔗 --bitcoin-rpc-read-url <url>        Bitcoin RPC URL for reading (default: http://127.0.0.1:18443)
  👤 --bitcoin-rpc-read-user <user>       Bitcoin RPC user for read operations
  🔑 --bitcoin-rpc-read-password <pass>   Bitcoin RPC password for read operations
  🔗 --bitcoin-rpc-write-url <url>        Bitcoin RPC URL for writing (optional)
  👤 --bitcoin-rpc-write-user <user>     Bitcoin RPC user for write operations (optional)
  🔑 --bitcoin-rpc-write-password <pass> Bitcoin RPC password for write operations (optional)
  📦 --start-block <number>              Start from specific block number
  🌐 --http-host <host>                  HTTP server host (default: 127.0.0.1)
  🔌 --http-port <port>                  HTTP server port (default: 8545)
  🔐 --mnemonic <phrase>                 Mnemonic phrase (not recommended - visible in process list)
  📄 --mnemonic-file <path>              Path to file containing mnemonic (recommended)
  ⚡ --electrum-url <url>                 Electrum server URL (for mainnet/signet/testnet)
  📁 --data-dir <path>                   Data directory for wallet and state (default: .)

💡 Examples:
  lane start --bitcoin-rpc-read-password bitcoin123
  lane start --start-block 916201 --mnemonic-file ~/.lane/mnemonic.txt
  lane start --http-port 8545 --data-dir /data

🔧 Notes:
  • Requires Bitcoin RPC access (local or remote)
  • Mnemonic file is more secure than --mnemonic flag
  • Default network is regtest, use --electrum-url for mainnet/testnet
`);
}

function showWalletHelp(): void {
  console.log(`
💰 lane wallet - Wallet operations
===================================

Manage wallets and get Bitcoin addresses.

📋 Usage:
  lane wallet <create|address|balance> [options]

🔧 Subcommands:
  create    - Create a new wallet
  address   - Get Bitcoin address from wallet
  balance   - Get Bitcoin/laneBTC balance

💡 Examples:
  lane wallet create
  lane wallet address
  lane wallet balance

📚 For subcommand-specific help: lane wallet <subcommand> --help
`);
}

function showBurnHelp(): void {
  console.log(`
🔥 lane burn - Burn BTC to get laneBTC
======================================

Burn Bitcoin to receive laneBTC on the LaneLayer network.

📋 Usage:
  lane burn [options]

⚙️  Options:
  💰 --burn-amount <amount>              Amount to burn (in satoshis)
  🔗 --chain-id <id>                     Chain ID for the burn
  📍 --eth-address <address>             Ethereum address to receive laneBTC
  🌐 --network <network>                 Network: regtest, testnet, mainnet (default: regtest)
  🔐 --mnemonic <phrase>                 Mnemonic phrase (not recommended)
  📄 --mnemonic-file <path>              Path to file containing mnemonic (recommended)
  🔗 --rpc-url <url>                     Bitcoin RPC URL (default: http://127.0.0.1:18443)
  👤 --rpc-user <user>                   Bitcoin RPC user (default: bitcoin)
  🔑 --rpc-password <pass>               Bitcoin RPC password
  ⚡ --electrum-url <url>                Electrum server URL (for mainnet/signet/testnet)
  📁 --data-dir <path>                   Data directory (default: .)

💡 Examples:
  lane burn --burn-amount 100000 --chain-id 1 --eth-address 0x...
  lane burn --burn-amount 500000 --network mainnet --electrum-url ssl://electrum.blockstream.info:50002

🔧 Notes:
  • Requires Bitcoin RPC access for regtest
  • Use --electrum-url for mainnet/testnet
  • Mnemonic file is more secure than --mnemonic flag
`);
}

function showExitHelp(): void {
  console.log(`
🚪 lane exit - Create exit intent (withdraw BTC)
=================================================

Create an exit intent to withdraw laneBTC back to Bitcoin.

📋 Usage:
  lane exit [options]

⚙️  Options:
  📍 --bitcoin-address <address>         Bitcoin address to receive funds
  💰 --amount <amount>                   Amount to withdraw (in satoshis)
  💸 --max-fee <amount>                  Maximum fee (optional)
  ⏰ --expire-by <block>                 Expire by block number
  📁 --data-dir <path>                   Data directory (default: .)

💡 Examples:
  lane exit --bitcoin-address bc1q... --amount 50000000 --expire-by 1000000

🔧 Notes:
  • Exit intent will be processed by the intent system
  • Check your Bitcoin wallet for received funds after processing
`);
}

function showStatusHelp(): void {
  console.log(`
📊 lane status - Check node status
===================================

Check the status of the Core Lane node and services.

📋 Usage:
  lane status

💡 What it shows:
  • Node running status
  • Last processed block
  • Service health
  • Connection status

🔧 Notes:
  • Checks both Docker services and Core Lane node
`);
}

function showUpHelp(): void {
  console.log(`
🐳 lane up - Start Docker environment
=====================================

Start the LaneLayer Docker environment (bitcoin-cache + core-lane).

📋 Usage:
  lane up [options]

⚙️  Options:
  🔐 --mnemonic <phrase>                 Mnemonic phrase for core-lane
  🌐 --network <network>                 Network: mainnet, testnet, regtest (default: mainnet)
  ⚡ --electrum-url <url>                Electrum server URL
  👤 --rpc-user <user>                   Bitcoin RPC user (default: bitcoin)
  🔑 --rpc-password <pass>               Bitcoin RPC password (default: bitcoin123)

💡 Examples:
  lane up
  lane up --mnemonic "your twelve word phrase" --network mainnet

🔧 Notes:
  • Starts bitcoin-cache and core-lane services
  • Uses docker-compose.yml in current directory
  • Requires Docker and docker-compose
`);
}

function showDownHelp(): void {
  console.log(`
🛑 lane down - Stop Docker environment
======================================

Stop the LaneLayer Docker environment.

📋 Usage:
  lane down

💡 What it does:
  • Stops all LaneLayer Docker services
  • Preserves data volumes
  • Can be restarted with 'lane up'

🔧 Notes:
  • Looks for docker-compose.yml in current directory
`);
}

// Removed unused help functions: showPushHelp, showCreateHelp, showExportHelp

function showLogsHelp(): void {
  console.log(`
📄 lane logs - View container logs
===================================

View logs from LaneLayer Docker services.

📋 Usage:
  lane logs [options] [service]

⚙️  Options:
  📺 -f, --follow                        Follow logs in real-time
  📊 --tail <lines>                      Show last N lines

💡 Examples:
  lane logs                              # View all service logs
  lane logs --follow                     # Follow logs in real-time
  lane logs core-lane                    # View core-lane service logs
  lane logs bitcoin-cache                # View bitcoin-cache service logs
  lane logs --tail 50                    # Show last 50 lines

🔧 Notes:
  • Default shows all service logs
  • Specify service name to filter logs
  • --follow continues showing new log entries
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
  • Quick start workflow
  • Key concepts (Bitcoin-anchored, intent-driven)
  • Common commands and examples
  • How to burn BTC and create exit intents

🔧 Notes:
  • Perfect for new users
  • Shows complete workflow from setup to usage
  • Includes examples for all major use cases
`);
}

// Removed unused help functions: showExecHelp, showShellHelp, showCatHelp, showPruneHelp, showPerfHelp
