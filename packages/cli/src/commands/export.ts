import { existsSync, mkdirSync, copyFileSync } from "fs";
import { join, resolve } from "path";
import { homedir } from "os";
import { createHash } from "crypto";
import {
  getComposeCacheDirectory,
  detectProfileAndSshKey,
  getPathHash,
} from "../cli";
import { showCommandHelp } from "./help";

// Import the updated getCacheDirectory function from build.ts
function getCacheDirectory(
  imageTag?: string,
  profile?: string,
  guestAgentImage?: string
): string {
  const pathHash = getPathHash();
  const baseCacheDir = join(homedir(), ".cache", "lane", pathHash);

  if (imageTag) {
    // Create a hash of the image tag for cache directory
    let hashInput = imageTag;

    // For prod/prod-debug profiles, include guest-agent image in the hash
    if (
      profile &&
      (profile === "prod" || profile === "prod-debug") &&
      guestAgentImage
    ) {
      hashInput += `:${guestAgentImage}`;
    }

    const imageHash = createHash("sha256")
      .update(hashInput)
      .digest("hex")
      .substring(0, 8);
    return join(baseCacheDir, imageHash);
  }

  return baseCacheDir;
}

export function handleExportCommand(args: string[]): void {
  // Check for help flag
  if (args.includes("--help") || args.includes("-h")) {
    showCommandHelp("export");
    return;
  }

  try {
    // Parse export arguments
    if (args.length < 3) {
      console.error(
        "Error: lane export requires exactly 2 arguments: <profile> <path>"
      );
      console.log("Usage: lane export <profile> <path> [options]");
      console.log("Examples:");
      console.log("  lane export prod ./my-prod-deployment");
      console.log("  lane export stage-release ./stage-artifacts");
      console.log("  lane export prod-debug ./debug-deployment");
      console.log(
        "  lane export prod ./my-prod-deployment --image my-registry/my-image:v1"
      );
      console.log(
        "  lane export prod ./my-prod-deployment --guest-agent-image my-registry/guest-agent:v2"
      );
      process.exit(1);
    }

    const profile = args[1];
    const exportPath = resolve(args[2]);
    let guestAgentImage: string | undefined;
    let imageTag: string | undefined;

    // Parse additional options
    for (let i = 3; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === "--guest-agent-image") {
        if (nextArg) {
          guestAgentImage = nextArg;
          i++; // Skip next argument
        } else {
          console.error("Error: --guest-agent-image requires a value");
          process.exit(1);
        }
      } else if (arg === "--image") {
        if (nextArg) {
          imageTag = nextArg;
          i++; // Skip next argument
        } else {
          console.error("Error: --image requires a value");
          process.exit(1);
        }
      }
    }

    // Validate profile
    const validProfiles = ["stage", "stage-release", "prod", "prod-debug"];
    if (!validProfiles.includes(profile)) {
      console.error(
        `Error: Invalid profile '${profile}'. Valid profiles: ${validProfiles.join(
          ", "
        )}`
      );
      process.exit(1);
    }

    console.log(`📦 Exporting ${profile} profile to: ${exportPath}`);
    if (imageTag) {
      console.log(`🖼️  Using image: ${imageTag}`);
    }
    if (guestAgentImage && (profile === "prod" || profile === "prod-debug")) {
      console.log(`🤖 Using guest agent image: ${guestAgentImage}`);
    }

    // Create export directory
    if (!existsSync(exportPath)) {
      mkdirSync(exportPath, { recursive: true });
      console.log(`✅ Created export directory: ${exportPath}`);
    }

    // Use the same cache directory logic as build (deterministic from image tag + profile + guestAgentImage)
    const resolvedImageTag =
      imageTag ?? `lane-build-${getPathHash()}:latest`;
    const cacheDir = getCacheDirectory(
      resolvedImageTag,
      profile,
      guestAgentImage
    );

    if (!existsSync(cacheDir)) {
      let buildCmd = `lane build ${profile}`;
      if (imageTag) buildCmd += ` --image ${imageTag}`;
      if (guestAgentImage && (profile === "prod" || profile === "prod-debug")) {
        buildCmd += ` --guest-agent-image ${guestAgentImage}`;
      }
      console.error(`❌ Error: Cache directory not found: ${cacheDir}`);
      console.error(`Run "${buildCmd}" first to create the required files.`);
      process.exit(1);
    }

    // Determine debug suffix for file names
    const includeDebugTools = profile === "stage" || profile === "prod-debug";
    const debugSuffix = includeDebugTools ? "-debug" : "-release";

    // Export files based on profile
    const exportedFiles: string[] = [];

    if (profile === "stage" || profile === "stage-release") {
      // Export QEMU-based profile files
      const qemuKernel = join(cacheDir, `vc${debugSuffix}.qemu-kernel`);
      const squashfs = join(cacheDir, `vc${debugSuffix}.squashfs`);

      if (!existsSync(qemuKernel)) {
        console.error(`❌ Error: QEMU kernel not found: ${qemuKernel}`);
        console.error(
          'Run "lane build ' + profile + '" first to create the required files.'
        );
        process.exit(1);
      }

      if (!existsSync(squashfs)) {
        console.error(`❌ Error: Squashfs not found: ${squashfs}`);
        console.error(
          'Run "lane build ' + profile + '" first to create the required files.'
        );
        process.exit(1);
      }

      // Copy QEMU kernel
      const exportedKernel = join(exportPath, "vc.qemu-kernel");
      copyFileSync(qemuKernel, exportedKernel);
      exportedFiles.push("vc.qemu-kernel");

      // Copy squashfs
      const exportedSquashfs = join(exportPath, "vc.squashfs");
      copyFileSync(squashfs, exportedSquashfs);
      exportedFiles.push("vc.squashfs");
    } else if (profile === "prod" || profile === "prod-debug") {
      // Export Cartesi Machine profile files
      const cmSquashfs = join(
        cacheDir,
        `vc-cm-snapshot${debugSuffix}.squashfs`
      );
      const rootHashFile = join(
        cacheDir,
        `vc-cm-snapshot${debugSuffix}.squashfs.root-hash`
      );
      const cmSnapshotPath = join(cacheDir, `vc-cm-snapshot${debugSuffix}`);
      const cmHashFile = join(cmSnapshotPath, "hash");

      if (!existsSync(cmSquashfs)) {
        console.error(
          `❌ Error: Cartesi machine squashfs not found: ${cmSquashfs}`
        );
        console.error(
          'Run "lane build ' + profile + '" first to create the required files.'
        );
        process.exit(1);
      }

      if (!existsSync(rootHashFile)) {
        console.error(`❌ Error: Root hash file not found: ${rootHashFile}`);
        console.error(
          'Run "lane build ' + profile + '" first to create the required files.'
        );
        process.exit(1);
      }

      if (!existsSync(cmHashFile)) {
        console.error(
          `❌ Error: Cartesi machine hash file not found: ${cmHashFile}`
        );
        console.error(
          'Run "lane build ' + profile + '" first to create the required files.'
        );
        process.exit(1);
      }

      // Copy Cartesi machine squashfs
      const exportedCmSquashfs = join(exportPath, "vc-cm-snapshot.squashfs");
      copyFileSync(cmSquashfs, exportedCmSquashfs);
      exportedFiles.push("vc-cm-snapshot.squashfs");

      // Copy root hash file
      const exportedRootHash = join(
        exportPath,
        "vc-cm-snapshot.squashfs.root-hash"
      );
      copyFileSync(rootHashFile, exportedRootHash);
      exportedFiles.push("vc-cm-snapshot.squashfs.root-hash");

      // Copy Cartesi machine hash file
      const exportedCmHash = join(exportPath, "vc-cm-snapshot.hash");
      copyFileSync(cmHashFile, exportedCmHash);
      exportedFiles.push("vc-cm-snapshot.hash");
    }

    // Export debug SSH key if profile has debug tools
    if (includeDebugTools) {
      const sshKeyPath = join(cacheDir, "ssh.debug-key");
      const sshKeyPubPath = join(cacheDir, "ssh.debug-key.pub");

      if (existsSync(sshKeyPath)) {
        const exportedSshKey = join(exportPath, "ssh.debug-key");
        copyFileSync(sshKeyPath, exportedSshKey);
        require("fs").chmodSync(exportedSshKey, 0o600);
        exportedFiles.push("ssh.debug-key");
      }

      if (existsSync(sshKeyPubPath)) {
        const exportedSshKeyPub = join(exportPath, "ssh.debug-key.pub");
        copyFileSync(sshKeyPubPath, exportedSshKeyPub);
        exportedFiles.push("ssh.debug-key.pub");
      }
    }

    console.log(
      `✅ Successfully exported ${profile} profile to: ${exportPath}`
    );
    console.log(`📁 Exported files:`);
    exportedFiles.forEach((file) => console.log(`   - ${file}`));
    console.log("");
  } catch (err) {
    console.error("Error exporting profile:", err);
    process.exit(1);
  }
}

function getFileDescription(filename: string, profile: string): string {
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
