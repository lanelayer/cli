# LaneLayer CLI

Build and run **HTTP server containers** for payments and intent execution on LaneLayer.

## ⚠️ Development Status

**This project is under heavy development and is not recommended for production use.** Features, APIs, and behavior may change without notice.

## License

Apache License v2.0

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

Containers receive raw data submissions via a single endpoint:

- **`POST /submit`** - Receives raw binary data from core-lane (Content-Type: `application/octet-stream`)
- Metadata is passed via X- prefixed HTTP headers (e.g., `X-Forwarded-From`, `X-User`)

**Quick test:**

```bash
lane up dev
lane submit --data "raw data here"
lane submit --file data.bin --header "X-Forwarded-From: source"
```

> **Note**: `lane submit` is for development/testing only. It sends to your local container, not to real lane nodes or DA.

See the [Webhooks Guide](docs/webhooks.md) for details.

**Need help?** Check the [documentation](docs/README.md) or run `lane --help`.
