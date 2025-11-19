import { showCommandHelp } from "./help";

export function handleBurnCommand(args: string[]): void {
  // Check for help flag
  if (args.includes("--help") || args.includes("-h")) {
    showCommandHelp("burn");
    return;
  }

  console.log("🔥 Burning BTC to get laneBTC...");
  console.log("⚠️  Implementation coming soon");
  // TODO: Implement burn command
}
