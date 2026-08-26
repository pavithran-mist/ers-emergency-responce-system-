"""WebSocket connection manager for real-time alert and telemetry broadcasts."""

import asyncio
import json
import logging
from typing import List, Set, Dict, Any
from fastapi import WebSocket

logger = logging.getLogger("astra.websocket")


class ConnectionManager:
    """Manages active WebSocket client connections and asynchronous broadcasts."""

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        """Accept and register new WebSocket connection."""
        await websocket.accept()
        async with self._lock:
            self.active_connections.add(websocket)
        logger.info(f"WebSocket client connected. Total clients: {len(self.active_connections)}")

    async def disconnect(self, websocket: WebSocket) -> None:
        """Unregister closed WebSocket connection."""
        async with self._lock:
            self.active_connections.discard(websocket)
        logger.info(f"WebSocket client disconnected. Total clients: {len(self.active_connections)}")

    async def broadcast(self, message: Dict[str, Any]) -> None:
        """Broadcast JSON payload to all connected clients."""
        if not self.active_connections:
            return

        payload_str = json.dumps(message)
        dead_connections: List[WebSocket] = []

        async with self._lock:
            connections = list(self.active_connections)

        for ws in connections:
            try:
                await ws.send_text(payload_str)
            except Exception as e:
                logger.debug(f"Failed to send to client ({e}). Marking dead.")
                dead_connections.append(ws)

        if dead_connections:
            async with self._lock:
                for ws in dead_connections:
                    self.active_connections.discard(ws)


ws_manager = ConnectionManager()
