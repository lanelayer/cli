#!/usr/bin/env python3
"""
Simple HTTP server with health endpoint and submission handler using aiohttp
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


async def submit_handler(request):
    """
    Handle transaction/intent submissions from core-lane.

    This endpoint receives submission data and queries lane state to check
    payment status, confirmations, and other relevant information.
    """
    try:
        data = await request.json()
        print(f"Received submission: {json.dumps(data, indent=2)}")

        # Extract submission data
        tx_hash = data.get("tx_hash")
        intent_id = data.get("intent_id")
        user = data.get("user")
        action = data.get("action")
        params = data.get("params", {})
        timestamp = data.get("timestamp")

        print(
            f"Processing submission - tx_hash: {tx_hash}, intent_id: {intent_id}, user: {user}"
        )

        # Get core-lane URL from environment
        core_lane_url = os.environ.get("CORE_LANE_URL", "http://core-lane:8545")

        # Query lane state to check payment status and other information
        if intent_id:
            # Check intent state and payment status
            intent_state = await check_intent_payment(intent_id, core_lane_url)
            print(f"Intent state for {intent_id}: {json.dumps(intent_state, indent=2)}")

            # Process based on state
            if intent_state:
                # Check if payment was made
                payment_made = intent_state.get("payment_made", False)
                if payment_made:
                    print(f"Payment confirmed for intent {intent_id}")
                    # Process the payment
                    # Update database, trigger business logic, etc.
                else:
                    print(f"No payment found for intent {intent_id}")
                    # Handle case where payment hasn't been made yet

        if tx_hash:
            # Check transaction state
            tx_state = await check_transaction_state(tx_hash, core_lane_url)
            print(f"Transaction state for {tx_hash}: {json.dumps(tx_state, indent=2)}")

            # Process based on transaction state
            if tx_state:
                confirmations = tx_state.get("confirmations", 0)
                amount = tx_state.get("amount")
                sender = tx_state.get("sender")

                print(
                    f"Transaction {tx_hash}: {confirmations} confirmations, {amount} sats from {sender}"
                )

                # Process based on confirmations
                if confirmations >= 1:
                    print(
                        f"Transaction {tx_hash} has {confirmations} confirmation(s) - processing"
                    )
                    # Transaction is confirmed, process it
                else:
                    print(f"Transaction {tx_hash} not yet confirmed - waiting")

        # Process the submission based on action
        if action:
            print(f"Processing action: {action} with params: {params}")
            # Handle different actions (purchase, transfer, etc.)
            # This is where your business logic goes

        return web.json_response(
            {
                "status": "ok",
                "message": "Submission processed successfully",
                "tx_hash": tx_hash,
                "intent_id": intent_id,
            },
            status=200,
        )
    except Exception as e:
        print(f"Error processing submission: {e}")
        import traceback

        traceback.print_exc()
        return web.json_response({"status": "error", "message": str(e)}, status=500)


async def check_intent_payment(intent_id: str, core_lane_url: str) -> dict:
    """
    Query lane state to check if payment was made for an intent using core-lane RPC.

    This demonstrates how containers can read lane state to verify payments.
    """
    try:
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


async def check_transaction_state(tx_hash: str, core_lane_url: str) -> dict:
    """
    Query lane state to check transaction details (confirmations, amount, sender, etc.).

    This demonstrates how containers can read lane state to check transaction status.
    """
    try:
        async with aiohttp.ClientSession() as session:
            payload = {
                "jsonrpc": "2.0",
                "method": "lane_getTransactionState",
                "params": [tx_hash],
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
                    print(f"Error checking transaction state: {response.status}")
                    return {}
    except Exception as e:
        print(f"Exception checking transaction state: {e}")
        return {}


app = web.Application()
app.router.add_get("/health", health)
app.router.add_post("/submit", submit_handler)


def run_app():
    """Function to run the app, used by watchgod/watchfiles"""
    port = int(os.environ.get("PORT", 8080))
    web.run_app(app, host="0.0.0.0", port=port)


if __name__ == "__main__":
    run_app()
