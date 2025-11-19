import { execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { cwd } from "process";

export function handleDownCommand(args: string[]): void {
  console.log("🛑 Stopping LaneLayer Docker environment...");

  try {
    // Look for docker-compose.yml in current directory or parent
    const currentDir = cwd();
    const composePath = join(currentDir, "docker-compose.yml");

    if (existsSync(composePath)) {
      execSync(`docker compose -f ${composePath} down`, { stdio: "inherit" });
      console.log("✅ LaneLayer environment stopped");
    } else {
      console.log("ℹ️  No docker-compose.yml found in current directory");
      console.log(
        "   Make sure you are in the core-lane directory or have docker-compose.yml"
      );
    }
  } catch (err) {
    console.error("Error stopping LaneLayer environment:", err);
    process.exit(1);
  }
}
