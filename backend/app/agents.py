"""Plugin agents on the GitHub Copilot SDK.

One shared ``CopilotClient``; one session per plugin activation. Each plugin brings its own skill
(system prompt), its own scoped tool set and its own UI whitelist – the manifest, made executable.
``stream_agent`` yields events (tool / message / result / error) for server-sent events.
"""

import asyncio
import json
import logging
import re
import tempfile
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any

from copilot import CopilotClient
from copilot.session import PermissionHandler
from copilot.session_events import AssistantMessageData, AssistantUsageData, ToolExecutionStartData

from app.config import settings
from app.genui import ALLOWED_BLOCKS, RenderUIParams, govern
from app.tools import build_render_ui_tool, build_tools

logger = logging.getLogger(__name__)

COMMON = """You are a clinical plugin agent running inside a governed clinical extension runtime, on top of the
hospital EMR. You were activated by a continuous query because your activation conditions became true.
Work only from tool results – never invent findings, values or segment ids. Cite EMR evidence by putting
segment ids (the [ids] from read_report) in item refs. Use clinically cautious language: you propose,
the clinician decides. Be concise: short titles, one-sentence details. All data is synthetic.
Finish by calling render_ui exactly once; do not answer in plain text."""


@dataclass(frozen=True)
class PluginSpec:
    skill: str
    tools: list[str]
    prompt: str


PLUGINS: dict[str, PluginSpec] = {
    "oncology-staging": PluginSpec(
        skill="""Skill: stage-extraction (lung cancer, AJCC/UICC 8th edition).
1. Read the pathology and all imaging reports.
2. Derive clinical T, N and M with the supporting segments. Be explicit about uncertainty – an
   indeterminate mediastinal node must lower N confidence and raise an alert.
3. Call ajcc_lung_stage for the stage group – never compute it yourself.
4. Check whether predictive biomarkers (EGFR, ALK, ROS1, KRAS, PD-L1) were requested; if not, add a gap.
Render: stage_proposal (required, first), then alert(s), gap, and a short evidence block for histology.
Headline format: 'cT? cN? cM? – stage ?? proposed; <key caveat>'.""",
        tools=["get_context", "list_reports", "read_report", "get_labs", "ajcc_lung_stage"],
        prompt="New pathology was signed for this patient during the oncology review. Propose the clinical stage.",
    ),
    "medication-safety": PluginSpec(
        skill="""Skill: renal-dosing review for nephrotoxic chemotherapy.
1. Find the drafted order(s) and the relevant labs (creatinine, eGFR trend, electrolytes).
2. Compute CrCl with cockcroft_gault (use the patient's age, weight, sex and latest creatinine).
3. Check the drug against get_protocol; also scan other orders and notes for related issues.
Render: alert (critical if protocol threshold not met) with numbers, trend of eGFR (chronological),
evidence for other observations, and options (required, last) with values hold / board / override.""",
        tools=["get_context", "get_orders", "get_labs", "get_notes", "cockcroft_gault", "get_protocol"],
        prompt="A nephrotoxic chemotherapy order was drafted while renal function is impaired. Review it.",
    ),
    "trial-matching": PluginSpec(
        skill="""Skill: eligibility screening.
1. Use the clinician-confirmed stage (get_confirmed_stage) – never re-stage.
2. Read the molecular report for driver alterations.
3. search_trials and evaluate every criterion of plausible trials: met / unmet / unknown with reason.
Render: trial_match for the best candidate (required, first; body says how many screened/excluded),
then gap for open eligibility items.""",
        tools=["get_context", "get_confirmed_stage", "list_reports", "read_report", "search_trials"],
        prompt="Biomarker results arrived for a patient with a confirmed stage. Screen for open trials.",
    ),
}

_client: CopilotClient | None = None
_client_lock = asyncio.Lock()
_workdir = tempfile.mkdtemp(prefix="clinical-ext-agent-")


async def _get_client() -> CopilotClient:
    global _client
    async with _client_lock:
        if _client is None:
            client = CopilotClient(
                github_token=settings.copilot_token,
                use_logged_in_user=settings.copilot_token is None and settings.copilot_use_logged_in_user,
                working_directory=_workdir,
                log_level="warning",
            )
            await client.start()
            _client = client
        return _client


async def warmup() -> None:
    try:
        await _get_client()
    except Exception as exc:  # noqa: BLE001 - warm-up is best effort; the first request retries
        logger.warning("Copilot SDK warm-up failed: %s", exc)


async def shutdown() -> None:
    global _client
    if _client is not None:
        try:
            await _client.stop()
        finally:
            _client = None


def _short(args: Any) -> str:
    text = args if isinstance(args, str) else json.dumps(args, ensure_ascii=False)
    return (text or "")[:160]


_UNICODE_ESCAPE = re.compile(r"\\u([0-9a-fA-F]{4})")


def _unescape(value: Any) -> Any:
    """Models occasionally double-escape non-ASCII text (literal ``\\u2192``); restore the characters."""
    if isinstance(value, str):
        return _UNICODE_ESCAPE.sub(lambda m: chr(int(m.group(1), 16)), value)
    if isinstance(value, list):
        return [_unescape(v) for v in value]
    if isinstance(value, dict):
        return {k: _unescape(v) for k, v in value.items()}
    return value


async def stream_agent(plugin: str, payload: dict[str, Any]) -> AsyncIterator[dict[str, Any]]:
    """Run one plugin activation; yield trace events as they happen, then a result (or error)."""
    spec = PLUGINS[plugin]
    if settings.copilot_auth_mode == "not-configured":
        yield {"type": "error", "message": "Copilot SDK not configured (set COPILOT_GITHUB_TOKEN)."}
        return

    loop = asyncio.get_running_loop()
    queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()
    rendered: list[RenderUIParams] = []
    messages: list[str] = []
    models: list[str] = []
    started = time.perf_counter()

    def emit(event: dict[str, Any]) -> None:
        loop.call_soon_threadsafe(queue.put_nowait, event)

    def on_event(event) -> None:
        match event.data:
            case ToolExecutionStartData() as data:
                if data.tool_name == "render_ui":
                    args = data.arguments if isinstance(data.arguments, dict) else {}
                    types = [b.get("type") for b in args.get("blocks", []) if isinstance(b, dict)]
                    emit({"type": "tool", "tool": "render_ui", "args": f"{len(types)} blocks: {', '.join(types)}"})
                else:
                    emit({"type": "tool", "tool": data.tool_name, "args": _short(data.arguments)})
            case AssistantMessageData() as data if data.content:
                messages.append(data.content)
            case AssistantUsageData() as data if data.model:
                models.append(data.model)

    scoped = build_tools(payload)
    tools = [scoped[name] for name in spec.tools] + [build_render_ui_tool(plugin, rendered.append)]

    async def run() -> None:
        try:
            client = await _get_client()
            async with await client.create_session(
                on_permission_request=PermissionHandler.approve_all,
                model=settings.copilot_model,
                tools=tools,
                available_tools=[t.name for t in tools],
                system_message={"mode": "replace", "content": f"{COMMON}\n\n{spec.skill}"},
                skip_custom_instructions=True,
                enable_config_discovery=False,
                working_directory=_workdir,
            ) as session:
                session.on(on_event)
                await session.send_and_wait(spec.prompt, timeout=settings.agent_timeout_seconds)
        except Exception as exc:  # noqa: BLE001 - any SDK/auth/network failure is reported; the UI degrades
            logger.warning("Copilot SDK call failed for %s: %s", plugin, exc)
            emit({"type": "error", "message": f"Copilot SDK unavailable ({type(exc).__name__})"})
        finally:
            emit(None)

    task = asyncio.create_task(run())
    try:
        while True:
            event = await queue.get()
            if event is None:
                break
            yield event
            if event["type"] == "error":
                return
    finally:
        if not task.done():
            task.cancel()

    ms = round((time.perf_counter() - started) * 1000)
    if not rendered:
        text = "\n\n".join(messages).strip()
        yield {
            "type": "result",
            "headline": "Agent answered in text",
            "blocks": [{"type": "summary", "title": "Agent response", "body": text or "No content.", "items": []}],
            "model": models[-1] if models else settings.copilot_model,
            "ms": ms,
        }
        return

    view = rendered[-1]
    blocks, dropped = govern(plugin, view)
    if dropped:
        logger.info("%s: %d block(s) outside manifest %s dropped", plugin, dropped, ALLOWED_BLOCKS[plugin])
    yield {
        "type": "result",
        "headline": _unescape(view.headline),
        "blocks": _unescape(blocks),
        "model": models[-1] if models else settings.copilot_model,
        "ms": ms,
    }
