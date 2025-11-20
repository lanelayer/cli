import { execSync } from "child_process";
import { join } from "path";
import { existsSync } from "fs";
import { getComposeCacheDirectory } from "../cli";

export function handleDownCommand(args: string[]): void {
  console.log("Stopping development environment...");
  try {
    const composePath = join(
      getComposeCacheDirectory(),
      "docker-compose.dev.json"
    );
    if (existsSync(composePath)) {
      execSync(`docker compose -f ${composePath} down`, { stdio: "inherit" });
      console.log("✅ Development environment stopped");
    } else {
      console.log("ℹ️  No docker-compose.dev.json found for current directory");
    }
  } catch (err) {
    console.error("Error stopping development environment:", err);
    process.exit(1);
  }
}
