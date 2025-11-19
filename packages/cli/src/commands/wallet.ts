import { showCommandHelp } from "./help";

export function handleWalletCommand(args: string[]): void {
  // Check for help flag
  if (args.includes("--help") || args.includes("-h")) {
    showCommandHelp("wallet");
    return;
  }

  const subcommand = args[1];

  if (!subcommand) {
    console.error("Error: wallet command requires a subcommand");
    console.log("Usage: lane wallet <create|address|balance>");
    process.exit(1);
  }

  switch (subcommand) {
    case "create":
      handleWalletCreate(args.slice(2));
      break;
    case "address":
      handleWalletAddress(args.slice(2));
      break;
    case "balance":
      handleWalletBalance(args.slice(2));
      break;
    default:
      console.error(`Unknown wallet subcommand: ${subcommand}`);
      console.log("Available subcommands: create, address, balance");
      process.exit(1);
  }
}

function handleWalletCreate(args: string[]): void {
  console.log("💰 Creating wallet...");
  console.log("⚠️  Implementation coming soon");
  // TODO: Implement wallet create
}

function handleWalletAddress(args: string[]): void {
  console.log("📍 Getting Bitcoin address...");
  console.log("⚠️  Implementation coming soon");
  // TODO: Implement wallet address
}

function handleWalletBalance(args: string[]): void {
  console.log("💵 Getting balance...");
  console.log("⚠️  Implementation coming soon");
  // TODO: Implement wallet balance
}
