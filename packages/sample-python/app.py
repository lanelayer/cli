#!/usr/bin/env python3
"""
Simple HTTP server with health endpoint and webhook handlers using aiohttp
"""

import aiohttp
from aiohttp import web
from datetime import datetime, timezone
import os
import json


async def health(request):
    return web.json_response(
        {
            "status": "OK",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "service": "sample-python",
            "version": "1.0.0",
        }
    )


async def webhook_payment(request):
    """Handle payment.received webhook events"""
    try:
        data = await request.json()
        print(f"Received payment webhook: {json.dumps(data, indent=2)}")

        event_type = data.get("event")
        if event_type == "payment.received":
            payment_data = data.get("data", {})
            tx_hash = payment_data.get("tx_hash")
            amount = payment_data.get("amount")
            sender = payment_data.get("sender")

            print(f"Payment received: {amount} sats from {sender} (tx: {tx_hash})")

            # Here you would typically:
            # 1. Verify the payment with core-lane RPC
            # 2. Update your database
            # 3. Trigger business logic

            return web.json_response(
                {"status": "ok", "message": "Payment received and processed"},
                status=200,
            )
        else:
            return web.json_response(
                {"status": "error", "message": "Unexpected event type"}, status=400
            )
    except Exception as e:
        print(f"Error processing payment webhook: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)


async def webhook_confirmation(request):
    """Handle transaction.confirmed webhook events"""
    try:
        data = await request.json()
        print(f"Received confirmation webhook: {json.dumps(data, indent=2)}")

        event_type = data.get("event")
        if event_type == "transaction.confirmed":
            tx_data = data.get("data", {})
            tx_hash = tx_data.get("tx_hash")
            block_height = tx_data.get("block_height")
            confirmations = tx_data.get("confirmations")

            print(
                f"Transaction confirmed: {tx_hash} at block {block_height} ({confirmations} confirmations)"
            )

            # Here you would typically:
            # 1. Update transaction status in database
            # 2. Trigger completion logic

            return web.json_response(
                {"status": "ok", "message": "Transaction confirmation processed"},
                status=200,
            )
        else:
            return web.json_response(
                {"status": "error", "message": "Unexpected event type"}, status=400
            )
    except Exception as e:
        print(f"Error processing confirmation webhook: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)


async def webhook_intent(request):
    """Handle intent.submitted webhook events"""
    try:
        data = await request.json()
        print(f"Received intent webhook: {json.dumps(data, indent=2)}")

        event_type = data.get("event")
        if event_type == "intent.submitted":
            intent_data = data.get("data", {})
            intent_id = intent_data.get("intent_id")
            user = intent_data.get("user")
            action = intent_data.get("action")
            params = intent_data.get("params", {})

            print(f"Intent submitted: {intent_id} by {user} for action {action}")

            # Example: Check if payment was made for this intent
            core_lane_url = os.environ.get("CORE_LANE_URL", "http://core-lane:8545")
            payment_status = await check_intent_payment(intent_id, core_lane_url)
            print(f"Payment status for intent {intent_id}: {payment_status}")

            return web.json_response(
                {
                    "status": "ok",
                    "message": "Intent submission processed",
                    "intent_id": intent_id,
                },
                status=200,
            )
        else:
            return web.json_response(
                {"status": "error", "message": "Unexpected event type"}, status=400
            )
    except Exception as e:
        print(f"Error processing intent webhook: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)


async def check_intent_payment(intent_id: str, core_lane_url: str) -> dict:
    """
    Example function to check if payment was made for an intent using core-lane RPC

    This demonstrates how containers can read lane state to verify payments.
    """
    try:
        # Example RPC call to core-lane to check intent state
        # In production, you would use the actual core-lane RPC API
        async with aiohttp.ClientSession() as session:
            payload = {
                "jsonrpc": "2.0",
                "method": "lane_getIntentState",
                "params": [intent_id],
                "id": 1,
            }
            async with session.post(
                f"{core_lane_url}/",
                json=payload,
                headers={"Content-Type": "application/json"},
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    return result.get("result", {})
                else:
                    print(f"Error checking intent payment: {response.status}")
                    return {}
    except Exception as e:
        print(f"Exception checking intent payment: {e}")
        return {}


app = web.Application()
app.router.add_get("/health", health)
app.router.add_post("/webhook/payment", webhook_payment)
app.router.add_post("/webhook/confirmation", webhook_confirmation)
app.router.add_post("/webhook/intent", webhook_intent)


def run_app():
    """Function to run the app, used by watchgod/watchfiles"""
    port = int(os.environ.get("PORT", 8080))
    web.run_app(app, host="0.0.0.0", port=port)


if __name__ == "__main__":
    run_app()
