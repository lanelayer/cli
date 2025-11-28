#!/usr/bin/env python3
"""
Simple HTTP server with health endpoint and submission handler using aiohttp
"""

import aiohttp
from aiohttp import web
from datetime import datetime, timezone
import os
import json
import logging
import asyncio

# Set up logging
logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)


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
    Handle raw data submissions from core-lane.

    This endpoint receives raw binary data (application/octet-stream) with
    optional metadata passed via X- prefixed HTTP headers.
    """
    try:
        # Read raw binary data
        data = await request.read()

        # Extract metadata from headers
        forwarded_from = request.headers.get("X-Forwarded-From")
        content_type = request.headers.get("X-Content-Type")
        user = request.headers.get("X-User")
        timestamp = request.headers.get("X-Timestamp")

        logger.info(
            f"Received {len(data)} bytes from {forwarded_from or 'unknown source'}"
        )

        if forwarded_from:
            logger.info(f"Source: {forwarded_from}")
        if user:
            logger.info(f"User: {user}")
        if timestamp:
            logger.info(f"Timestamp: {timestamp}")

        # Process the raw data
        # Data can be any format: binary, text, JSON string, etc.

        # If X-Content-Type indicates JSON, try to parse it
        if content_type == "application/json":
            try:
                json_data = json.loads(data.decode("utf-8"))
                logger.info(f"Parsed JSON data: {json.dumps(json_data, indent=2)}")
                # Process JSON data as needed
                process_json_data(json_data, user, timestamp)
            except (json.JSONDecodeError, UnicodeDecodeError) as e:
                logger.warning(f"Failed to parse JSON data: {e}")
                # Continue processing as raw data
                process_raw_data(data, forwarded_from, user)
        else:
            # Process raw binary data
            process_raw_data(data, forwarded_from, user)

        return web.json_response(
            {
                "status": "ok",
                "message": "Submission processed successfully",
                "bytes_received": len(data),
            },
            status=200,
        )
    except Exception as e:
        logger.exception("Unexpected error processing submission")
        return web.json_response({"status": "error", "message": str(e)}, status=500)


def process_raw_data(data: bytes, source: str = None, user: str = None):
    """Process raw binary data."""
    logger.info(f"Processing {len(data)} bytes of raw data")
    # Add your data processing logic here
    # This is where you handle the raw binary data


def process_json_data(json_data: dict, user: str = None, timestamp: str = None):
    """Process JSON data (when X-Content-Type indicates JSON)."""
    logger.info(f"Processing JSON data for user: {user}")
    # Add your JSON processing logic here
    # This is where you handle structured JSON data


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
                    logger.warning(
                        f"Error checking intent payment: HTTP {response.status}"
                    )
                    return {}
    except asyncio.TimeoutError as e:
        logger.exception("Timeout while checking intent payment")
        return {}
    except aiohttp.ClientError as e:
        logger.exception("Network error while checking intent payment")
        return {}
    except json.JSONDecodeError as e:
        logger.exception("Failed to parse JSON response when checking intent payment")
        return {}
    except Exception as e:
        logger.exception("Unexpected error checking intent payment")
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
                    logger.warning(
                        f"Error checking transaction state: HTTP {response.status}"
                    )
                    return {}
    except asyncio.TimeoutError as e:
        logger.exception("Timeout while checking transaction state")
        return {}
    except aiohttp.ClientError as e:
        logger.exception("Network error while checking transaction state")
        return {}
    except json.JSONDecodeError as e:
        logger.exception(
            "Failed to parse JSON response when checking transaction state"
        )
        return {}
    except Exception as e:
        logger.exception("Unexpected error checking transaction state")
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
