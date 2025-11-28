# Webhooks Guide

LaneLayer containers receive raw data submissions from core-lane via a single `/submit` endpoint. The endpoint accepts raw binary data with optional metadata passed via HTTP headers.

## Overview

When data is submitted to core-lane, core-lane calls your container's `/submit` endpoint with raw binary data. Any metadata (such as source, type, or context) is passed via X- prefixed HTTP headers, keeping data and metadata separate.

## Submission Endpoint

### Endpoint

**`POST /submit`**

Core-lane calls this endpoint with raw binary data.

### Request Format

- **Content-Type**: `application/octet-stream`
- **Body**: Raw binary data (any format)
- **Headers**: Standard HTTP headers + optional X- prefixed metadata headers

### Metadata Headers

Metadata is passed via X- prefixed HTTP headers. Examples:

- `X-Forwarded-From: source_name`
- `X-Content-Type: application/json` (if data is JSON, but sent as octet-stream)
- `X-User: user_address`
- `X-Timestamp: 2024-01-15T10:40:00Z`
- Any custom X- headers your application needs

### Example Handler

```python
import aiohttp
from aiohttp import web
import os

async def submit_handler(request):
    """Handle raw data submissions"""
    # Read raw binary data
    data = await request.read()

    # Extract metadata from headers
    forwarded_from = request.headers.get("X-Forwarded-From")
    content_type = request.headers.get("X-Content-Type")
    user = request.headers.get("X-User")
    timestamp = request.headers.get("X-Timestamp")

    # Process the raw data
    # Data can be any format: binary, text, JSON string, etc.
    logger.info(f"Received {len(data)} bytes from {forwarded_from}")

    # If data is JSON (indicated by X-Content-Type header)
    if content_type == "application/json":
        import json
        try:
            json_data = json.loads(data.decode("utf-8"))
            # Process JSON data
            process_json_submission(json_data, user, timestamp)
        except json.JSONDecodeError:
            logger.error("Failed to parse JSON data")
            return web.json_response(
                {"status": "error", "message": "Invalid JSON"},
                status=400
            )
    else:
        # Process raw binary data
        process_raw_data(data, forwarded_from, user)

    return web.json_response({
        "status": "ok",
        "message": "Submission processed"
    }, status=200)
```

## Querying Lane State

Containers automatically receive the `CORE_LANE_URL` environment variable (default: `http://core-lane:8545`) to query lane state.

### Check Intent Payment Status

```python
async def check_intent_payment(intent_id: str, core_lane_url: str) -> dict:
    """Query lane state to check if payment was made for an intent"""
    async with aiohttp.ClientSession() as session:
        payload = {
            "jsonrpc": "2.0",
            "method": "lane_getIntentState",
            "params": [intent_id],
            "id": 1
        }
        async with session.post(
            f"{core_lane_url}/",
            json=payload,
            headers={"Content-Type": "application/json"}
        ) as response:
            if response.status == 200:
                result = await response.json()
                return result.get("result", {})
    return {}
```

### Check Transaction State

```python
async def check_transaction_state(tx_hash: str, core_lane_url: str) -> dict:
    """Query lane state to check transaction details"""
    async with aiohttp.ClientSession() as session:
        payload = {
            "jsonrpc": "2.0",
            "method": "lane_getTransactionState",
            "params": [tx_hash],
            "id": 1
        }
        async with session.post(
            f"{core_lane_url}/",
            json=payload,
            headers={"Content-Type": "application/json"}
        ) as response:
            if response.status == 200:
                result = await response.json()
                return result.get("result", {})
    return {}
```

## Processing Flow

1. **Receive Submission**: Core-lane POSTs to `/submit` with transaction/intent data
2. **Query State**: Container queries lane state via `CORE_LANE_URL` to check:
   - Payment status for intents
   - Transaction confirmations
   - Block height
   - Other relevant state
3. **Process**: Container processes based on state query results
4. **Respond**: Return success/error response

## Environment Variables

- `CORE_LANE_URL` - URL of core-lane RPC endpoint (automatically set by CLI, default: `http://core-lane:8545`)

This environment variable is automatically provided to containers, allowing them to query the state of the lane(s) they're sitting on top of.

## Local Testing

For local development, you can test the submission endpoint using the `lane submit` command or by sending HTTP POST requests directly to your container.

> **Note**: The `lane submit` command is for **development and testing purposes only**. It does NOT send submissions to real lane nodes or DA. It only sends to your local running container.

### Using lane submit (Recommended)

The easiest way to test submissions is using the `lane submit` command:

```bash
# Make sure your container is running
lane up dev

# Send raw string data
lane submit --data "raw data here"

# Send file contents
lane submit --file data.bin

# Send from stdin
echo "data" | lane submit --stdin

# Send with metadata headers
lane submit --data "data" --header "X-Forwarded-From: source" --header "X-User: user123"

# Send JSON data with metadata
lane submit --data '{"key":"value"}' --header "X-Content-Type: application/json" --header "X-User: bc1q..."

# Get help
lane submit --help
```

### Using curl (Alternative)

You can also use `curl` directly:

```bash
# Send raw data
curl -X POST http://localhost:8080/submit \
  -H "Content-Type: application/octet-stream" \
  -H "X-Forwarded-From: test" \
  --data-binary "raw binary data"

# Send file
curl -X POST http://localhost:8080/submit \
  -H "Content-Type: application/octet-stream" \
  -H "X-Content-Type: application/json" \
  -H "X-User: bc1q..." \
  --data-binary @data.json
```

### Using the Test Script

A test script is provided in the repository root:

```bash
# Make sure your container is running
lane up dev

# Run the test script
./test-webhooks.sh
```

### Viewing Logs

To see submissions being processed:

```bash
lane logs --follow
```

## Complete Example

See `packages/sample-python/app.py` for a complete example with:

- `/submit` endpoint handler
- Lane state querying functions
- Payment verification logic
- Error handling

## Best Practices

1. **Always Query State**: Don't rely solely on submission data - query lane state to verify payment status
2. **Idempotency**: Submissions may be delivered multiple times. Make your handler idempotent.
3. **Error Handling**: Always handle errors gracefully and return appropriate HTTP status codes
4. **Logging**: Log all submissions and state queries for debugging and auditing
5. **Validation**: Validate submission data before processing

## Troubleshooting

### Container Not Receiving Submissions

1. Check container is running: `docker ps` or `lane logs`
2. Verify endpoint exists: `curl http://localhost:8080/health`
3. Test submission endpoint:
   - Using CLI: `lane submit --user "bc1qtest" --action "test"`
   - Using curl: `curl -X POST http://localhost:8080/submit -H "Content-Type: application/json" -d '{"user":"bc1qtest","action":"test","timestamp":"2024-01-15T10:40:00Z"}'`

### State Queries Failing

1. Verify `CORE_LANE_URL` is set: `docker exec <container> env | grep CORE_LANE_URL`
2. Check core-lane is accessible from container
3. Verify RPC method names match core-lane API

### Wrong Response Format

Make sure your submission payload matches the expected schema. All fields except `tx_hash` and `intent_id` are optional, but at least one should be present.
