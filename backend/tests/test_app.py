import json

import pytest
from fastapi.testclient import TestClient

from app import agents
from app.config import settings
from app.genui import ALLOWED_BLOCKS, GenBlock, RenderUIParams, govern, render_ui_schema
from app.main import app
from app.tools import build_tools, cockcroft_gault, lung_stage

PAYLOAD = {
    "plugin": "oncology-staging",
    "workflow": "oncology-review",
    "clinician": "Dr. Test",
    "patient": {
        "id": "P1",
        "name": "Test",
        "sex": "F",
        "age": 64,
        "weight_kg": 61,
        "problems": [],
        "reports": [
            {
                "id": "PATH-1",
                "kind": "pathology",
                "title": "Biopsy",
                "date": "07.10.2026",
                "segments": [{"text": "Specimen."}, {"id": "path-histo", "text": "Adenocarcinoma."}],
            }
        ],
        "labs": [],
        "orders": [],
        "notes": [],
    },
    "confirmed_stage": None,
}

client = TestClient(app)


def test_status() -> None:
    body = client.get("/api/status").json()
    assert body["copilot"]["auth_mode"] in {"token", "logged-in-user", "not-configured"}
    assert set(body["plugins"]) == set(ALLOWED_BLOCKS)


def test_unknown_plugin_404() -> None:
    assert client.post("/api/agent/nope/stream", json=PAYLOAD).status_code == 404


def test_not_configured_streams_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "copilot_token", None)
    monkeypatch.setattr(settings, "copilot_use_logged_in_user", False)
    res = client.post("/api/agent/oncology-staging/stream", json=PAYLOAD)
    events = [json.loads(line[5:]) for line in res.text.splitlines() if line.startswith("data:")]
    assert events == [{"type": "error", "message": "Copilot SDK not configured (set COPILOT_GITHUB_TOKEN)."}]


def test_plugins_only_get_scoped_tools() -> None:
    tools = build_tools(PAYLOAD)
    for spec in agents.PLUGINS.values():
        assert set(spec.tools) <= set(tools)
    assert "search_trials" not in agents.PLUGINS["oncology-staging"].tools
    assert "get_protocol" not in agents.PLUGINS["trial-matching"].tools


def test_render_ui_schema_is_narrowed_per_manifest() -> None:
    for plugin, allowed in ALLOWED_BLOCKS.items():
        schema = render_ui_schema(plugin)
        assert schema["properties"]["blocks"]["items"]["properties"]["type"]["enum"] == allowed
        assert "$defs" not in json.dumps(schema)


def test_govern_drops_blocks_outside_manifest() -> None:
    view = RenderUIParams(
        headline="h",
        blocks=[GenBlock(type="stage_proposal", title="s"), GenBlock(type="options", title="o")],
    )
    blocks, dropped = govern("oncology-staging", view)
    assert [b["type"] for b in blocks] == ["stage_proposal"] and dropped == 1


@pytest.mark.parametrize(
    ("tnm", "stage"),
    [
        (("T2a", "N1", "M0"), "IIB"),
        (("T2a", "N0", "M0"), "IB"),
        (("T3", "N2", "M0"), "IIIB"),
        (("T1a", "N0", "M1c"), "IVB"),
    ],
)
def test_lung_stage(tnm: tuple[str, str, str], stage: str) -> None:
    assert lung_stage(*tnm) == stage


def test_cockcroft_gault_matches_demo() -> None:
    assert cockcroft_gault(58, 74, 1.71, female=False) == pytest.approx(49.3, abs=0.1)
