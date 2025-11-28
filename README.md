# LaneLayer CLI

Build and run **HTTP server containers** for payments and intent execution on LaneLayer.

## ⚠️ Development Status

**This project is under heavy development and is not recommended for production use.** Features, APIs, and behavior may change without notice.

## License

Currently unlicensed.

## 🚀 Quick Start

```bash
# Install
npm install -g @lanelayer/cli

# Create and run
lane create myapp --template python
cd myapp
lane up dev
```

## 📚 Documentation

- **[Quick Start & Profiles](docs/README.md)** - Get up and running fast
- **[Workflow Guide](docs/workflow.md)** - Detailed development process
- **[CLI Reference](docs/reference.md)** - Complete command reference
- **[Advanced Topics](docs/advanced.md)** - Power user features
- **[Webhooks Guide](docs/webhooks.md)** - Event-driven development with webhooks

## 🏗️ Build Profiles

- **`dev`** - Native platform, fastest development
- **`stage`** - Testing environment with debug tools
- **`stage-release`** - Testing environment without debug tools
- **`prod`** - Production-ready verifiable environment
- **`prod-debug`** - Production environment with debug tools

## 📦 Prerequisites

- Docker and buildx
- vsock support (auto-installed if needed)

---

**That's it!** LaneLayer handles the complexity - you just write standard HTTP servers.

## 🔔 Submissions

Containers receive transaction and intent submissions via a single endpoint:

- **`POST /submit`** - Receives submissions from core-lane

Containers query lane state using `CORE_LANE_URL` to check payment status and process accordingly.

**Quick test:**

```bash
lane up dev
lane submit --tx-hash "abc123" --intent-id "intent_123" --user "bc1..." --action "purchase"
```

> **Note**: `lane submit` is for development/testing only. It sends to your local container, not to real lane nodes or DA.

See the [Webhooks Guide](docs/webhooks.md) for details.

**Need help?** Check the [documentation](docs/README.md) or run `lane --help`.
