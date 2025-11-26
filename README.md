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

## 🔔 Webhooks

Containers can receive events via HTTP webhooks:

- Payment notifications (`/webhook/payment`)
- Transaction confirmations (`/webhook/confirmation`)
- Intent submissions (`/webhook/intent`)

**Quick test:**

```bash
lane up dev
curl -X POST http://localhost:8080/webhook/payment \
  -H "Content-Type: application/json" \
  -d '{"event":"payment.received","data":{"tx_hash":"abc123","amount":1000000}}'
```

See the [Webhooks Guide](docs/webhooks.md) and [Testing Guide](docs/testing-webhooks.md) for details.

**Need help?** Check the [documentation](docs/README.md) or run `lane --help`.
