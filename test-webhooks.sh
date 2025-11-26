#!/bin/bash
# Test script for submission endpoint

BASE_URL="${BASE_URL:-http://localhost:8080}"

echo "Testing submission endpoint at $BASE_URL"
echo "========================================"
echo ""

# Test submission with intent
echo "1. Testing submission with intent..."
INTENT_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "tx_hash": "abc123def456...",
    "intent_id": "intent_123",
    "user": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    "action": "purchase",
    "params": {
      "item_id": "item_456",
      "quantity": 2
    },
    "timestamp": "2024-01-15T10:40:00Z"
  }')

HTTP_CODE=$(echo "$INTENT_RESPONSE" | tail -n1)
BODY=$(echo "$INTENT_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "✓ Intent submission: SUCCESS ($HTTP_CODE)"
  echo "  Response: $BODY"
else
  echo "✗ Intent submission: FAILED ($HTTP_CODE)"
  echo "  Response: $BODY"
fi
echo ""

# Test submission with transaction
echo "2. Testing submission with transaction..."
TX_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "tx_hash": "abc123def456...",
    "user": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    "action": "transfer",
    "params": {
      "recipient": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
      "amount": 1000000
    },
    "timestamp": "2024-01-15T10:30:00Z"
  }')

HTTP_CODE=$(echo "$TX_RESPONSE" | tail -n1)
BODY=$(echo "$TX_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "✓ Transaction submission: SUCCESS ($HTTP_CODE)"
  echo "  Response: $BODY"
else
  echo "✗ Transaction submission: FAILED ($HTTP_CODE)"
  echo "  Response: $BODY"
fi
echo ""

# Test submission with comprehensive data
echo "3. Testing submission with comprehensive data..."
COMPREHENSIVE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "tx_hash": "def789ghi012...",
    "intent_id": "intent_456",
    "user": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    "action": "purchase",
    "params": {
      "item_id": "item_789",
      "quantity": 1,
      "price": 500000
    },
    "timestamp": "2024-01-15T10:45:00Z",
    "block_height": 850000,
    "confirmations": 1
  }')

HTTP_CODE=$(echo "$COMPREHENSIVE_RESPONSE" | tail -n1)
BODY=$(echo "$COMPREHENSIVE_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "✓ Comprehensive submission: SUCCESS ($HTTP_CODE)"
  echo "  Response: $BODY"
else
  echo "✗ Comprehensive submission: FAILED ($HTTP_CODE)"
  echo "  Response: $BODY"
fi
echo ""

echo "========================================"
echo "Testing complete!"
echo ""
echo "To view container logs: lane logs --follow"

