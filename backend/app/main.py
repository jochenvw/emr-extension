"""Clinical extension runtime API: plugin agents (GitHub Copilot SDK) streamed over server-sent events."""

import asyncio
import json
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import Body, FastAPI, HTTPException
from fastapi.responses import FileResponse, StreamingResponse

from app import agents
from app.config import settings
from app.genui import ALLOWED_BLOCKS


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Pre-warm the Copilot SDK client so the first plugin activation in the demo is not a cold start.
    warmup = asyncio.create_task(agents.warmup()) if settings.copilot_auth_mode != "not-configured" else None
    yield
    if warmup and not warmup.done():
        warmup.cancel()
    await agents.shutdown()


app = FastAPI(title="Clinical Extensions runtime", lifespan=lifespan)


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok"}


@app.get("/api/status")
async def status() -> dict:
    return {
        "status": "ok",
        "copilot": {"auth_mode": settings.copilot_auth_mode, "model": settings.copilot_model or "default"},
        "plugins": {name: {"tools": spec.tools, "ui": ALLOWED_BLOCKS[name]} for name, spec in agents.PLUGINS.items()},
    }


@app.post("/api/agent/{plugin}/stream")
async def agent_stream(plugin: str, payload: dict[str, Any] = Body(...)) -> StreamingResponse:  # noqa: B008
    if plugin not in agents.PLUGINS:
        raise HTTPException(status_code=404, detail=f"Unknown plugin '{plugin}'")

    async def sse() -> AsyncIterator[str]:
        async for event in agents.stream_agent(plugin, payload):
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        sse(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )


@app.get("/{path:path}", include_in_schema=False)
async def spa(path: str) -> FileResponse:
    root = settings.static_dir.resolve()
    if path.startswith("api/"):
        raise HTTPException(status_code=404)
    target = (root / path).resolve()
    if path and target.is_file() and root in target.parents:
        return FileResponse(target)
    index = root / "index.html"
    if index.is_file():
        return FileResponse(index)
    raise HTTPException(status_code=404, detail="Frontend not built. Run `npm run build` or use `npm run dev`.")
