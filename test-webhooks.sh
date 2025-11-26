#!/bin/bash
# Test script for webhook endpoints

BASE_URL="${BASE_URL:-http://localhost:8080}"

echo "Testing webhook endpoints at $BASE_URL"
echo "========================================"
echo ""

# Test payment webhook
echo "1. Testing payment webhook..."
PAYMENT_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/webhook/payment" \
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
  }')

HTTP_CODE=$(echo "$PAYMENT_RESPONSE" | tail -n1)
BODY=$(echo "$PAYMENT_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "✓ Payment webhook: SUCCESS ($HTTP_CODE)"
  echo "  Response: $BODY"
else
  echo "✗ Payment webhook: FAILED ($HTTP_CODE)"
  echo "  Response: $BODY"
fi
echo ""

# Test confirmation webhook
echo "2. Testing confirmation webhook..."
CONFIRMATION_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/webhook/confirmation" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "transaction.confirmed",
    "timestamp": "2024-01-15T10:35:00Z",
    "data": {
      "tx_hash": "abc123def456...",
      "block_height": 850000,
      "confirmations": 1,
      "block_hash": "def789..."
    }
  }')

HTTP_CODE=$(echo "$CONFIRMATION_RESPONSE" | tail -n1)
BODY=$(echo "$CONFIRMATION_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "✓ Confirmation webhook: SUCCESS ($HTTP_CODE)"
  echo "  Response: $BODY"
else
  echo "✗ Confirmation webhook: FAILED ($HTTP_CODE)"
  echo "  Response: $BODY"
fi
echo ""

# Test intent webhook
echo "3. Testing intent webhook..."
INTENT_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/webhook/intent" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "intent.submitted",
    "timestamp": "2024-01-15T10:40:00Z",
    "data": {
      "intent_id": "intent_123",
      "user": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
      "action": "purchase",
      "params": {
        "item_id": "item_456",
        "quantity": 2
      }
    }
  }')

HTTP_CODE=$(echo "$INTENT_RESPONSE" | tail -n1)
BODY=$(echo "$INTENT_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "✓ Intent webhook: SUCCESS ($HTTP_CODE)"
  echo "  Response: $BODY"
else
  echo "✗ Intent webhook: FAILED ($HTTP_CODE)"
  echo "  Response: $BODY"
fi
echo ""

echo "========================================"
echo "Testing complete!"
echo ""
echo "To view container logs: lane logs --follow"

