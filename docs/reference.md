# CLI Reference

Complete command reference for LaneLayer CLI.

---

## 📋 Commands

| Command                                | Description                           |
| -------------------------------------- | ------------------------------------- |
| `lane intro`                           | Show introduction                     |
| `lane create <name> --template <lang>` | Create new project                    |
| `lane build <profile> [options]`       | Build container images                |
| `lane up <profile> [options]`          | Build and run                         |
| `lane down`                            | Stop environment                      |
| `lane logs [options]`                  | View logs                             |
| `lane shell [options]`                 | Open shell                            |
| `lane exec [options] <command>`        | Run command                           |
| `lane cat <file>`                      | View file                             |
| `lane submit [options]`                | Send raw data to container (dev only) |
| `lane export <profile> <path>`         | Export build                          |
| `lane push <registry>`                 | Push to registry                      |
| `lane prune [--local]`                 | Clean up                              |
| `lane perf <subcommand>`               | Performance profiling                 |

---

## ⚙️ Common Options

### Build & Run

```bash
--hot                    # Enable hot reload
--image <image>          # Use existing image
--force-rebuild          # Force rebuild
--cache-dir <path>       # Custom cache directory
```

### Debug

```bash
--system                 # Target system container
--follow                 # Follow logs in real-time
```

---

## 🎯 Profiles

- `dev` - Native platform, fastest
- `stage` - RISC-V QEMU, debug tools
- `stage-release` - RISC-V QEMU, no debug
- `prod` - Cartesi Machine, production
- `prod-debug` - Cartesi Machine, debug tools

---

## 📝 Examples

### Development

```bash
# Create and start
lane create myapp --template python
cd myapp
lane up dev --hot

# Debug
lane logs --follow
lane shell
lane exec "ls -la"

# Send raw data to container
lane submit --data "raw data here"
lane submit --file data.bin
echo "data" | lane submit --stdin
lane submit --data "data" --header "X-Forwarded-From: source"
```

### Testing

```bash
# Test in RISC-V
lane up stage
lane shell --system
lane perf record
```

### Production

```bash
# Build and deploy
lane up prod
lane export prod ./deployment
lane push ghcr.io/org/myapp:latest
```

### Maintenance

```bash
# Clean up
lane down
lane prune --local

# Get help
lane --help
lane <command> --help
```

---

## 🔧 Templates

- `python` - Python application

---

## 🌐 Environment Variables

### Webhook Configuration

- `CORE_LANE_URL` - URL of core-lane RPC endpoint (default: `http://core-lane:8545`)

### K/V Storage API

- `KV_URL` - URL of the ephemeral key-value storage service (dev/test only)
- See [docs/kv-api.md](file:///Users/michaelasiedu/Code/cli/docs/kv-api.md) for full storage API details.

---

**Need more details?** Run `lane <command> --help` for specific command help.
