# Add K/V Storage API for Dev/Test Mode

Adds an ephemeral key-value storage API to the CLI's dev/test environment, enabling derived lane containers to read, write, and delete state during local development.

## Changes

- **New:** `packages/kv-service/` - Express server with K/V endpoints
- **Modified:** `packages/cli/src/generate.ts` - Added K/V service to Docker Compose
- **Modified:** `packages/sample-python/app.py` - Added `kv_get`, `kv_set`, `kv_delete` helpers

## Testing from Source

```bash
# 1. Build the CLI
cd packages/cli && npm run build

# 2. Run sample app with dev profile
cd ../sample-python
node ../cli/dist/cli.js up dev

# 3. Test K/V API
curl -X POST http://localhost:8080/kv/test -d "hello"
curl http://localhost:8080/kv/test        # → "hello"
curl -X DELETE http://localhost:8080/kv/test
curl http://localhost:8080/kv/test        # → "Not found"

# 4. Verify internal connectivity (container -> K/V)
curl -X POST http://localhost:8080/submit -H "X-User: Alice"
curl http://localhost:8080/kv/last_submission  # → "Alice" ✅

# 5. Verify app still works
curl http://localhost:8080/health

# 6. Clean up
node ../cli/dist/cli.js down
```

---

## API Reference

| Method   | Path        | Body                       | Description        |
| -------- | ----------- | -------------------------- | ------------------ |
| `GET`    | `/kv/<key>` | —                          | Read value for key |
| `POST`   | `/kv/<key>` | `application/octet-stream` | Set value for key  |
| `DELETE` | `/kv/<key>` | —                          | Delete key         |

### Keys

Keys can include path segments:

- `user_count`
- `users/alice/balance`

### Python Usage

```python
from app import kv_get, kv_set, kv_delete

await kv_set("counter", "42")
value = await kv_get("counter")  # b"42"
await kv_delete("counter")
```

## Storage Behavior

| Environment    | Persistence                       |
| -------------- | --------------------------------- |
| **Dev/Test**   | Ephemeral (resets on `lane down`) |
| **Production** | Persistent (blockchain-anchored)  |
