"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleDownCommand = handleDownCommand;
const child_process_1 = require("child_process");
const path_1 = require("path");
const fs_1 = require("fs");
const cli_1 = require("../cli");
function handleDownCommand(args) {
    console.log("Stopping development environment...");
    try {
        const composePath = (0, path_1.join)((0, cli_1.getComposeCacheDirectory)(), "docker-compose.dev.json");
        if ((0, fs_1.existsSync)(composePath)) {
            (0, child_process_1.execSync)(`docker compose -f ${composePath} down`, { stdio: "inherit" });
            console.log("✅ Development environment stopped");
        }
        else {
            console.log("ℹ️  No docker-compose.dev.json found for current directory");
        }
    }
    catch (err) {
        console.error("Error stopping development environment:", err);
        process.exit(1);
    }
}
