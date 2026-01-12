"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProject = createProject;
exports.handleCreateCommand = handleCreateCommand;
const child_process_1 = require("child_process");
const path_1 = require("path");
const fs_1 = require("fs");
const help_1 = require("./help");
function createProject(targetDir, template) {
    console.log(`Creating new LaneLayer project: ${targetDir}`);
    console.log(`Using template: ${template}`);
    // Check if target directory already exists
    if ((0, fs_1.existsSync)(targetDir)) {
        console.error(`Error: Directory '${targetDir}' already exists`);
        console.log("Please choose a different directory name or remove the existing directory");
        process.exit(1);
    }
    // Create target directory
    try {
        (0, fs_1.mkdirSync)(targetDir, { recursive: true });
    }
    catch (err) {
        console.error(`Error creating directory '${targetDir}':`, err);
        process.exit(1);
    }
    // Clone the template repository
    const templateUrl = `https://github.com/lanelayer/cli`;
    const tempDir = (0, path_1.join)(targetDir, ".temp-clone");
    try {
        console.log(`Cloning LaneLayer CLI repository to get template...`);
        (0, child_process_1.execSync)(`git clone ${templateUrl} ${tempDir}`, { stdio: "inherit" });
        // Check if the template directory exists
        const templateDir = (0, path_1.join)(tempDir, "packages", `sample-${template}`);
        if (!(0, fs_1.existsSync)(templateDir)) {
            console.error(`Error: Template '${template}' not found`);
            console.log("Available templates:");
            try {
                const packagesDir = (0, path_1.join)(tempDir, "packages");
                if ((0, fs_1.existsSync)(packagesDir)) {
                    const packages = (0, child_process_1.execSync)(`ls -d ${packagesDir}/sample-* 2>/dev/null | sed 's|.*/sample-||'`, { encoding: "utf8" })
                        .trim()
                        .split("\n");
                    packages.forEach((pkg) => {
                        if (pkg)
                            console.log(`  - ${pkg}`);
                    });
                }
            }
            catch (listErr) {
                console.log("  (Could not list available templates)");
            }
            process.exit(1);
        }
        // Remove .git directory from the cloned repo
        const gitDir = (0, path_1.join)(tempDir, ".git");
        if ((0, fs_1.existsSync)(gitDir)) {
            (0, child_process_1.execSync)(`rm -rf "${gitDir}"`, { stdio: "ignore" });
        }
        // Move all files from template directory to target directory
        const files = (0, child_process_1.execSync)(`ls -A "${templateDir}"`, { encoding: "utf8" })
            .trim()
            .split("\n");
        for (const file of files) {
            if (file) {
                const sourcePath = (0, path_1.join)(templateDir, file);
                const targetPath = (0, path_1.join)(targetDir, file);
                (0, child_process_1.execSync)(`mv "${sourcePath}" "${targetPath}"`, { stdio: "ignore" });
            }
        }
        // Remove temp directory
        (0, child_process_1.execSync)(`rm -rf "${tempDir}"`, { stdio: "ignore" });
        console.log("✅ Project created successfully!");
        console.log("");
        console.log("Next steps:");
        console.log(`  cd ${targetDir}`);
        console.log("  lane up dev");
        console.log("");
        console.log("Available commands:");
        console.log("  lane build    # Build the container");
        console.log("  lane up       # Build and run the development environment");
        console.log("  lane down     # Stop the development environment");
        console.log("  lane logs     # View container logs");
        console.log("  lane shell    # Open shell in the container");
    }
    catch (err) {
        console.error("Error creating project:", err);
        // Cleanup on error
        try {
            if ((0, fs_1.existsSync)(tempDir)) {
                (0, child_process_1.execSync)(`rm -rf "${tempDir}"`, { stdio: "ignore" });
            }
            if ((0, fs_1.existsSync)(targetDir)) {
                (0, child_process_1.execSync)(`rm -rf "${targetDir}"`, { stdio: "ignore" });
            }
        }
        catch (cleanupErr) {
            console.error("Error during cleanup:", cleanupErr);
        }
        process.exit(1);
    }
}
function handleCreateCommand(args) {
    // Check for help flag
    if (args.includes("--help") || args.includes("-h")) {
        (0, help_1.showCommandHelp)("create");
        return;
    }
    let projectName;
    let template;
    // Parse create arguments
    for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        const nextArg = args[i + 1];
        if (arg === "--template") {
            if (nextArg) {
                template = nextArg;
                i++; // Skip next argument
            }
            else {
                console.error("Error: --template requires a value");
                process.exit(1);
            }
        }
        else if (!projectName) {
            // First non-flag argument is the project name
            projectName = arg;
        }
    }
    if (!projectName) {
        console.error("Error: lane create requires a project name");
        console.log("Usage: lane create <project-name> --template <lang>");
        console.log("Examples:");
        console.log("  lane create myapp --template python");
        console.log("  lane create webapp --template node");
        process.exit(1);
    }
    if (!template) {
        console.error("Error: lane create requires a template");
        console.log("Usage: lane create <project-name> --template <lang>");
        console.log("Available templates: python, node, go, rust");
        process.exit(1);
    }
    createProject(projectName, template);
}
