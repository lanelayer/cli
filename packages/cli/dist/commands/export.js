"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleExportCommand = handleExportCommand;
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = require("path");
const os_1 = require("os");
const crypto_1 = require("crypto");
const cli_1 = require("../cli");
const help_1 = require("./help");
// Import the updated getCacheDirectory function from build.ts
function getCacheDirectory(imageTag, profile, guestAgentImage) {
    const pathHash = (0, cli_1.getPathHash)();
    const baseCacheDir = (0, path_1.join)((0, os_1.homedir)(), ".cache", "lane", pathHash);
    if (imageTag) {
        // Create a hash of the image tag for cache directory
        let hashInput = imageTag;
        // For prod/prod-debug profiles, include guest-agent image in the hash
        if (profile &&
            (profile === "prod" || profile === "prod-debug") &&
            guestAgentImage) {
            hashInput += `:${guestAgentImage}`;
        }
        const imageHash = (0, crypto_1.createHash)("sha256")
            .update(hashInput)
            .digest("hex")
            .substring(0, 8);
        return (0, path_1.join)(baseCacheDir, imageHash);
    }
    return baseCacheDir;
}
function handleExportCommand(args) {
    // Check for help flag
    if (args.includes("--help") || args.includes("-h")) {
        (0, help_1.showCommandHelp)("export");
        return;
    }
    try {
        // Parse export arguments
        if (args.length < 3) {
            console.error("Error: lane export requires exactly 2 arguments: <profile> <path>");
            console.log("Usage: lane export <profile> <path> [options]");
            console.log("Examples:");
            console.log("  lane export prod ./my-prod-deployment");
            console.log("  lane export stage-release ./stage-artifacts");
            console.log("  lane export prod-debug ./debug-deployment");
            console.log("  lane export prod ./my-prod-deployment --guest-agent-image my-registry/guest-agent:v2");
            process.exit(1);
        }
        const profile = args[1];
        const exportPath = (0, path_1.resolve)(args[2]);
        let guestAgentImage;
        // Parse additional options
        for (let i = 3; i < args.length; i++) {
            const arg = args[i];
            const nextArg = args[i + 1];
            if (arg === "--guest-agent-image") {
                if (nextArg) {
                    guestAgentImage = nextArg;
                    i++; // Skip next argument
                }
                else {
                    console.error("Error: --guest-agent-image requires a value");
                    process.exit(1);
                }
            }
        }
        // Validate profile
        const validProfiles = ["stage", "stage-release", "prod", "prod-debug"];
        if (!validProfiles.includes(profile)) {
            console.error(`Error: Invalid profile '${profile}'. Valid profiles: ${validProfiles.join(", ")}`);
            process.exit(1);
        }
        console.log(`📦 Exporting ${profile} profile to: ${exportPath}`);
        if (guestAgentImage && (profile === "prod" || profile === "prod-debug")) {
            console.log(`🤖 Using guest agent image: ${guestAgentImage}`);
        }
        // Create export directory
        if (!(0, fs_1.existsSync)(exportPath)) {
            (0, fs_1.mkdirSync)(exportPath, { recursive: true });
            console.log(`✅ Created export directory: ${exportPath}`);
        }
        // Get cache directory using the same logic as build process
        const pathHash = (0, cli_1.getPathHash)();
        const baseCacheDir = (0, path_1.join)((0, os_1.homedir)(), ".cache", "lane", pathHash);
        // For export, we need to find the actual cache directory
        // Since we don't have the image tag, we'll look for the most recent subdirectory
        // that matches our guest-agent image hash if specified
        let cacheDir = baseCacheDir;
        if ((0, fs_1.existsSync)(baseCacheDir)) {
            try {
                if (guestAgentImage &&
                    (profile === "prod" || profile === "prod-debug")) {
                    // For prod/prod-debug with guest-agent image, we need to find the specific cache directory
                    // Create a hash that includes the guest-agent image
                    const hashInput = `lane-build-${pathHash}:latest:${guestAgentImage}`;
                    const imageHash = (0, crypto_1.createHash)("sha256")
                        .update(hashInput)
                        .digest("hex")
                        .substring(0, 8);
                    const specificCacheDir = (0, path_1.join)(baseCacheDir, imageHash);
                    if ((0, fs_1.existsSync)(specificCacheDir)) {
                        cacheDir = specificCacheDir;
                        console.log(`✅ Found cache directory for guest agent image: ${cacheDir}`);
                    }
                    else {
                        console.error(`❌ Error: Cache directory not found for guest agent image: ${guestAgentImage}`);
                        console.error('Run "lane build ' +
                            profile +
                            " --guest-agent-image " +
                            guestAgentImage +
                            '" first to create the required files.');
                        process.exit(1);
                    }
                }
                else {
                    // Find the most recent subdirectory (which should contain our build artifacts)
                    const subdirs = (0, child_process_1.execSync)(`ls -1t "${baseCacheDir}" | head -1`, {
                        encoding: "utf8",
                    }).trim();
                    if (subdirs) {
                        cacheDir = (0, path_1.join)(baseCacheDir, subdirs);
                    }
                }
            }
            catch (err) {
                // If we can't find a subdirectory, use the base directory
                console.log("⚠️  Could not determine exact cache subdirectory, using base directory");
            }
        }
        // Determine debug suffix for file names
        const includeDebugTools = profile === "stage" || profile === "prod-debug";
        const debugSuffix = includeDebugTools ? "-debug" : "-release";
        // Export files based on profile
        const exportedFiles = [];
        if (profile === "stage" || profile === "stage-release") {
            // Export QEMU-based profile files
            const qemuKernel = (0, path_1.join)(cacheDir, `vc${debugSuffix}.qemu-kernel`);
            const squashfs = (0, path_1.join)(cacheDir, `vc${debugSuffix}.squashfs`);
            if (!(0, fs_1.existsSync)(qemuKernel)) {
                console.error(`❌ Error: QEMU kernel not found: ${qemuKernel}`);
                console.error('Run "lane build ' + profile + '" first to create the required files.');
                process.exit(1);
            }
            if (!(0, fs_1.existsSync)(squashfs)) {
                console.error(`❌ Error: Squashfs not found: ${squashfs}`);
                console.error('Run "lane build ' + profile + '" first to create the required files.');
                process.exit(1);
            }
            // Copy QEMU kernel
            const exportedKernel = (0, path_1.join)(exportPath, "vc.qemu-kernel");
            (0, fs_1.copyFileSync)(qemuKernel, exportedKernel);
            exportedFiles.push("vc.qemu-kernel");
            // Copy squashfs
            const exportedSquashfs = (0, path_1.join)(exportPath, "vc.squashfs");
            (0, fs_1.copyFileSync)(squashfs, exportedSquashfs);
            exportedFiles.push("vc.squashfs");
        }
        else if (profile === "prod" || profile === "prod-debug") {
            // Export Cartesi Machine profile files
            const cmSquashfs = (0, path_1.join)(cacheDir, `vc-cm-snapshot${debugSuffix}.squashfs`);
            const rootHashFile = (0, path_1.join)(cacheDir, `vc-cm-snapshot${debugSuffix}.squashfs.root-hash`);
            const cmSnapshotPath = (0, path_1.join)(cacheDir, `vc-cm-snapshot${debugSuffix}`);
            const cmHashFile = (0, path_1.join)(cmSnapshotPath, "hash");
            if (!(0, fs_1.existsSync)(cmSquashfs)) {
                console.error(`❌ Error: Cartesi machine squashfs not found: ${cmSquashfs}`);
                console.error('Run "lane build ' + profile + '" first to create the required files.');
                process.exit(1);
            }
            if (!(0, fs_1.existsSync)(rootHashFile)) {
                console.error(`❌ Error: Root hash file not found: ${rootHashFile}`);
                console.error('Run "lane build ' + profile + '" first to create the required files.');
                process.exit(1);
            }
            if (!(0, fs_1.existsSync)(cmHashFile)) {
                console.error(`❌ Error: Cartesi machine hash file not found: ${cmHashFile}`);
                console.error('Run "lane build ' + profile + '" first to create the required files.');
                process.exit(1);
            }
            // Copy Cartesi machine squashfs
            const exportedCmSquashfs = (0, path_1.join)(exportPath, "vc-cm-snapshot.squashfs");
            (0, fs_1.copyFileSync)(cmSquashfs, exportedCmSquashfs);
            exportedFiles.push("vc-cm-snapshot.squashfs");
            // Copy root hash file
            const exportedRootHash = (0, path_1.join)(exportPath, "vc-cm-snapshot.squashfs.root-hash");
            (0, fs_1.copyFileSync)(rootHashFile, exportedRootHash);
            exportedFiles.push("vc-cm-snapshot.squashfs.root-hash");
            // Copy Cartesi machine hash file
            const exportedCmHash = (0, path_1.join)(exportPath, "vc-cm-snapshot.hash");
            (0, fs_1.copyFileSync)(cmHashFile, exportedCmHash);
            exportedFiles.push("vc-cm-snapshot.hash");
        }
        // Export debug SSH key if profile has debug tools
        if (includeDebugTools) {
            const sshKeyPath = (0, path_1.join)(cacheDir, "ssh.debug-key");
            const sshKeyPubPath = (0, path_1.join)(cacheDir, "ssh.debug-key.pub");
            if ((0, fs_1.existsSync)(sshKeyPath)) {
                const exportedSshKey = (0, path_1.join)(exportPath, "ssh.debug-key");
                (0, fs_1.copyFileSync)(sshKeyPath, exportedSshKey);
                require("fs").chmodSync(exportedSshKey, 0o600);
                exportedFiles.push("ssh.debug-key");
            }
            if ((0, fs_1.existsSync)(sshKeyPubPath)) {
                const exportedSshKeyPub = (0, path_1.join)(exportPath, "ssh.debug-key.pub");
                (0, fs_1.copyFileSync)(sshKeyPubPath, exportedSshKeyPub);
                exportedFiles.push("ssh.debug-key.pub");
            }
        }
        console.log(`✅ Successfully exported ${profile} profile to: ${exportPath}`);
        console.log(`📁 Exported files:`);
        exportedFiles.forEach((file) => console.log(`   - ${file}`));
        console.log("");
    }
    catch (err) {
        console.error("Error exporting profile:", err);
        process.exit(1);
    }
}
function getFileDescription(filename, profile) {
    switch (filename) {
        case "ssh.debug-key":
            return "SSH private key for debug access";
        case "ssh.debug-key.pub":
            return "SSH public key";
        case "vc.qemu-kernel":
            return "QEMU kernel image";
        case "vc.squashfs":
            return "Root filesystem image";
        case "vc-cm-snapshot.squashfs":
            return "Cartesi machine snapshot";
        case "vc-cm-snapshot.squashfs.root-hash":
            return "Root hash for verity verification";
        case "vc-cm-snapshot.hash":
            return "Cartesi machine deterministic hash";
        default:
            return "Profile-specific file";
    }
}
