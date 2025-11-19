import { showCommandHelp } from "./help";

export function handleStatusCommand(args: string[]): void {
  // Check for help flag
  if (args.includes("--help") || args.includes("-h")) {
    showCommandHelp("status");
    return;
  }

  console.log("📊 Checking LaneLayer status...");
  console.log("⚠️  Implementation coming soon");
  // TODO: Implement status command
}
