from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from collections import defaultdict

router = APIRouter(prefix="/ws", tags=["WebSocket"])


class ConnectionManager:
    def __init__(self):
        self._rooms: dict[str, list[WebSocket]] = defaultdict(list)

    async def connect(self, room: str, ws: WebSocket) -> None:
        await ws.accept()
        self._rooms[room].append(ws)

    def disconnect(self, room: str, ws: WebSocket) -> None:
        self._rooms[room] = [w for w in self._rooms[room] if w is not ws]

    async def broadcast(self, room: str, data: dict) -> None:
        dead: list[WebSocket] = []
        for ws in list(self._rooms.get(room, [])):
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(room, ws)


manager = ConnectionManager()


@router.websocket("/raffle/{raffle_id}")
async def raffle_ws(raffle_id: str, websocket: WebSocket) -> None:
    await manager.connect(raffle_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(raffle_id, websocket)
