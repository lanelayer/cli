"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pruneLaneLocal = pruneLaneLocal;
exports.pruneLane = pruneLane;
const child_process_1 = require("child_process");
const path_1 = require("path");
const fs_1 = require("fs");
const os_1 = require("os");
// Import functions from the main CLI file
const cli_1 = require("../cli");
function pruneLaneLocal() {
    console.log("🧹 Pruning local LaneLayer environment...");
    try {
        // Stop development environment first
        console.log("Stopping development environment...");
        try {
            const composePath = (0, path_1.join)((0, cli_1.getComposeCacheDirectory)(), "docker-compose.dev.json");
            if ((0, fs_1.existsSync)(composePath)) {
                (0, child_process_1.execSync)(`docker compose -f ${composePath} down`, { stdio: "ignore" });
                console.log("✅ Development environment stopped");
            }
            else {
                console.log("ℹ️  No development environment to stop");
            }
        }
        catch (err) {
            console.log("ℹ️  Could not stop development environment");
        }
        // Wipe only the current project's cache directory
        console.log("Wiping local cache directory...");
        const localCacheDir = (0, cli_1.getComposeCacheDirectory)();
        if ((0, fs_1.existsSync)(localCacheDir)) {
            try {
                (0, child_process_1.execSync)(`rm -rf "${localCacheDir}"`, { stdio: "ignore" });
                console.log("✅ Local cache directory wiped");
            }
            catch (err) {
                console.error("⚠️  Could not wipe local cache directory:", err);
            }
        }
        else {
            console.log("ℹ️  Local cache directory does not exist");
        }
        console.log("✅ Local LaneLayer environment pruned successfully");
    }
    catch (err) {
        console.error("Error pruning local LaneLayer environment:", err);
        process.exit(1);
    }
}
function pruneLane() {
    console.log("🧹 Pruning LaneLayer environment...");
    try {
        // Stop development environment first
        console.log("Stopping development environment...");
        try {
            const composePath = (0, path_1.join)((0, cli_1.getComposeCacheDirectory)(), "docker-compose.dev.json");
            if ((0, fs_1.existsSync)(composePath)) {
                (0, child_process_1.execSync)(`docker compose -f ${composePath} down`, { stdio: "ignore" });
                console.log("✅ Development environment stopped");
            }
            else {
                console.log("ℹ️  No development environment to stop");
            }
        }
        catch (err) {
            console.log("ℹ️  Could not stop development environment");
        }
        // lane-builder no longer used - using default buildx builder
        // Wipe cache directory
        console.log("Wiping cache directory...");
        const cacheDir = (0, path_1.join)((0, os_1.homedir)(), ".cache", "lane");
        if ((0, fs_1.existsSync)(cacheDir)) {
            try {
                (0, child_process_1.execSync)(`rm -rf "${cacheDir}"`, { stdio: "ignore" });
                console.log("✅ Cache directory wiped");
            }
            catch (err) {
                console.error("⚠️  Could not wipe cache directory:", err);
            }
        }
        else {
            console.log("ℹ️  Cache directory does not exist");
        }
        console.log("✅ LaneLayer environment pruned successfully");
    }
    catch (err) {
        console.error("Error pruning LaneLayer environment:", err);
        process.exit(1);
    }
}
