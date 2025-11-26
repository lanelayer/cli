# Webhooks Guide

LaneLayer containers can receive events from the Bitcoin network and LaneLayer infrastructure via HTTP webhooks. This enables event-driven applications that react to payments, transaction confirmations, and intent submissions.

## Overview

Webhooks are delivered as HTTP POST requests directly from core-lane to your container on specific endpoints. The container automatically discovers webhook endpoints via path convention (`/webhook/*`). Containers can also query lane state using the `CORE_LANE_URL` environment variable.

## Event Types

### Payment Received

Triggered when a payment is detected on the blockchain.

**Endpoint:** `POST /webhook/payment`

**Event Schema:**

```json
{
  "event": "payment.received",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "tx_hash": "abc123def456...",
    "amount": 1000000,
    "sender": "bc1...",
    "confirmations": 0,
    "block_height": null
  }
}
```

**Example Handler (Python):**

```python
async def webhook_payment(request):
    data = await request.json()
    payment_data = data.get('data', {})
    tx_hash = payment_data.get('tx_hash')
    amount = payment_data.get('amount')
    sender = payment_data.get('sender')

    # Process payment
    process_payment(tx_hash, amount, sender)

    return web.json_response({'status': 'ok'}, status=200)
```

### Transaction Confirmed

Triggered when a transaction receives confirmations.

**Endpoint:** `POST /webhook/confirmation`

**Event Schema:**

```json
{
  "event": "transaction.confirmed",
  "timestamp": "2024-01-15T10:35:00Z",
  "data": {
    "tx_hash": "abc123def456...",
    "block_height": 850000,
    "confirmations": 1,
    "block_hash": "def789..."
  }
}
```

**Example Handler (Python):**

```python
async def webhook_confirmation(request):
    data = await request.json()
    tx_data = data.get('data', {})
    tx_hash = tx_data.get('tx_hash')
    confirmations = tx_data.get('confirmations')

    # Update transaction status
    update_transaction_status(tx_hash, confirmations)

    return web.json_response({'status': 'ok'}, status=200)
```

### Intent Submitted

Triggered when a user submits an intent.

**Endpoint:** `POST /webhook/intent`

**Event Schema:**

```json
{
  "event": "intent.submitted",
  "timestamp": "2024-01-15T10:40:00Z",
  "data": {
    "intent_id": "intent_123",
    "user": "bc1...",
    "action": "purchase",
    "params": {
      "item_id": "item_456",
      "quantity": 2
    }
  }
}
```

**Example Handler (Python):**

```python
async def webhook_intent(request):
    data = await request.json()
    intent_data = data.get('data', {})
    intent_id = intent_data.get('intent_id')
    user = intent_data.get('user')
    action = intent_data.get('action')

    # Process intent
    process_intent(intent_id, user, action)

    return web.json_response({'status': 'ok'}, status=200)
```

## Endpoint Discovery

Webhook endpoints are automatically discovered via path convention. Any route starting with `/webhook/` will be registered as a webhook endpoint.

**Supported patterns:**

- `/webhook/payment` - Payment events
- `/webhook/confirmation` - Transaction confirmation events
- `/webhook/intent` - Intent submission events
- `/webhook/*` - Custom webhook endpoints

## Reading Lane State

Containers can read the state of lanes they're sitting on top of using core-lane RPC. This is useful for verifying payments and checking intent status.

**Example: Checking Intent Payment Status**

```python
import aiohttp
import os

async def check_intent_payment(intent_id: str) -> dict:
    """Check if payment was made for an intent"""
    core_lane_url = os.environ.get('CORE_LANE_URL', 'http://core-lane:8545')

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
                return result.get('result', {})
    return {}
```

**Environment Variables:**

- `CORE_LANE_URL` - URL of core-lane RPC endpoint (automatically set by CLI, default: `http://core-lane:8545`)

This environment variable is automatically provided to containers, allowing them to query the state of the lane(s) they're sitting on top of.

## Local Testing

For local development, you can test webhooks by sending HTTP POST requests directly to your container.

### Quick Test with curl

```bash
# Test payment webhook
curl -X POST http://localhost:8080/webhook/payment \
  -H "Content-Type: application/json" \
  -d '{
    "event": "payment.received",
    "timestamp": "2024-01-15T10:30:00Z",
    "data": {
      "tx_hash": "abc123def456...",
      "amount": 1000000,
      "sender": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
      "confirmations": 0,
      "block_height": null
    }
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

To see webhook events being processed:

```bash
lane logs --follow
```

For detailed testing instructions, see [Testing Webhooks Guide](testing-webhooks.md).

## Complete Example

See `packages/sample-python/app.py` for a complete example with all webhook handlers and lane state reading.

## Best Practices

1. **Idempotency**: Webhooks may be delivered multiple times. Make your handlers idempotent.
2. **Error Handling**: Always return appropriate HTTP status codes and handle errors gracefully.
3. **Verification**: Verify payments by reading lane state before processing.
4. **Logging**: Log all webhook events for debugging and auditing.

## Future Enhancements

- Webhook authentication (signatures, API keys)
- Retry logic and delivery guarantees
- Webhook endpoint configuration file
- Event filtering and routing
