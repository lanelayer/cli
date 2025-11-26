# Webhooks Guide

LaneLayer containers receive transaction and intent submissions from core-lane via a single `/submit` endpoint. Containers query lane state to check payment status, confirmations, and process submissions accordingly.

## Overview

When a transaction or intent is submitted to core-lane, core-lane calls your container's `/submit` endpoint with comprehensive submission data. Your container then queries lane state using the `CORE_LANE_URL` environment variable to check payment status, confirmations, and other relevant information before processing.

## Submission Endpoint

### Endpoint

**`POST /submit`**

Core-lane calls this endpoint when transactions or intents are submitted.

### Request Schema

```json
{
  "tx_hash": "abc123def456...",
  "intent_id": "intent_123",
  "user": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  "action": "purchase",
  "params": {
    "item_id": "item_456",
    "quantity": 2
  },
  "timestamp": "2024-01-15T10:40:00Z",
  "block_height": 850000,
  "confirmations": 1
}
```

**Fields:**

- `tx_hash` (string, optional) - Transaction hash
- `intent_id` (string, optional) - Intent identifier
- `user` (string) - User address
- `action` (string) - Action type (e.g., "purchase", "transfer")
- `params` (object, optional) - Action-specific parameters
- `timestamp` (string) - ISO 8601 timestamp
- `block_height` (number, optional) - Block height if confirmed
- `confirmations` (number, optional) - Number of confirmations

### Example Handler

```python
import aiohttp
from aiohttp import web
import os
import json

async def submit_handler(request):
    """Handle transaction/intent submissions"""
    data = await request.json()

    tx_hash = data.get("tx_hash")
    intent_id = data.get("intent_id")
    user = data.get("user")
    action = data.get("action")

    # Get core-lane URL from environment
    core_lane_url = os.environ.get("CORE_LANE_URL", "http://core-lane:8545")

    # Query lane state to check payment status
    if intent_id:
        intent_state = await check_intent_payment(intent_id, core_lane_url)
        payment_made = intent_state.get("payment_made", False)

        if payment_made:
            # Process the payment
            process_payment(intent_id, user, action)
        else:
            # Payment not yet made
            handle_pending_payment(intent_id)

    if tx_hash:
        # Check transaction state
        tx_state = await check_transaction_state(tx_hash, core_lane_url)
        confirmations = tx_state.get("confirmations", 0)

        if confirmations >= 1:
            # Transaction confirmed, process it
            process_transaction(tx_hash, tx_state)

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

For local development, you can test the submission endpoint by sending HTTP POST requests directly to your container.

### Quick Test

```bash
# Test submission with intent
curl -X POST http://localhost:8080/submit \
  -H "Content-Type: application/json" \
  -d '{
    "tx_hash": "abc123",
    "intent_id": "intent_123",
    "user": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    "action": "purchase",
    "params": {"item_id": "item_456", "quantity": 2},
    "timestamp": "2024-01-15T10:40:00Z"
  }'
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

1. Check container is running: `docker ps`
2. Verify endpoint exists: `curl http://localhost:8080/health`
3. Test submission endpoint: `curl -X POST http://localhost:8080/submit -H "Content-Type: application/json" -d '{"test": "data"}'`

### State Queries Failing

1. Verify `CORE_LANE_URL` is set: `docker exec <container> env | grep CORE_LANE_URL`
2. Check core-lane is accessible from container
3. Verify RPC method names match core-lane API

### Wrong Response Format

Make sure your submission payload matches the expected schema. All fields except `tx_hash` and `intent_id` are optional, but at least one should be present.
