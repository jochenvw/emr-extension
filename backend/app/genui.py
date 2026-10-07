"""Generative UI contract (mirrors src/agent/blocks.ts).

Agents never emit markup. They call ``render_ui`` with typed blocks; the surface renders each block
with an approved component. Each plugin manifest whitelists which block types its agent may use –
enforced twice: in the tool schema the model sees, and again when the result is returned.
"""

from typing import Any, Literal

from pydantic import BaseModel, Field

BlockType = Literal["summary", "stage_proposal", "evidence", "gap", "alert", "trend", "options", "trial_match"]
Severity = Literal["info", "warning", "critical"]

ALLOWED_BLOCKS: dict[str, list[str]] = {
    "oncology-staging": ["summary", "stage_proposal", "evidence", "gap", "alert"],
    "medication-safety": ["summary", "alert", "trend", "options", "evidence"],
    "trial-matching": ["summary", "trial_match", "gap", "evidence"],
}

BLOCK_GUIDE: dict[str, str] = {
    "summary": "summary: short narrative (body). Use sparingly.",
    "stage_proposal": (
        "stage_proposal: exactly three items labelled 'T', 'N', 'M'. value is the category only "
        "(T1a,T1b,T1c,T2a,T2b,T3,T4 | N0,N1,N2,N3 | M0,M1a,M1b,M1c). detail = reasoning, refs = segment ids, "
        "confidence 0-1. body = histology one-liner."
    ),
    "evidence": "evidence: items quoting statements; refs = segment ids they come from.",
    "gap": (
        "gap: missing information the clinician should act on (body explains why). For a missing biomarker "
        "panel add one item with value 'order-biomarkers'."
    ),
    "alert": "alert: something needing attention; set severity (info|warning|critical); body explains.",
    "trend": "trend: values over time; items in chronological order, label = date 'dd.mm', value = number only.",
    "options": (
        "options: the decision the clinician makes. Items with value exactly 'hold', 'board', 'override' "
        "(hold order for review / take alternative to tumour board / proceed with clinical override). "
        "Put 'Recommended' in the detail of the option you recommend."
    ),
    "trial_match": (
        "trial_match: one block per candidate trial; title = trial id + short name; items = eligibility criteria "
        "with status met|unmet|unknown, detail = why, refs = segment ids. body = screening summary."
    ),
}


class GenItem(BaseModel):
    label: str = Field(description="Main text of the item")
    detail: str | None = Field(default=None, description="Explanation, reasoning or rationale")
    value: str | None = Field(default=None, description="Machine value (TNM category, option id, number)")
    refs: list[str] | None = Field(default=None, description="EMR segment ids supporting this item")
    confidence: float | None = Field(default=None, description="0-1 confidence")
    status: Literal["met", "unmet", "unknown"] | None = None
    severity: Severity | None = None


class GenBlock(BaseModel):
    type: BlockType
    title: str
    body: str | None = None
    severity: Severity | None = None
    items: list[GenItem] = Field(default_factory=list)


class RenderUIParams(BaseModel):
    headline: str = Field(description="One-line headline for the whole view (max ~90 characters)")
    blocks: list[GenBlock] = Field(description="Blocks in display order")


def inline_schema(schema: dict[str, Any]) -> dict[str, Any]:
    """Inline ``$defs`` references so tool schemas are self-contained for every model."""
    defs = schema.pop("$defs", {})

    def resolve(node: Any) -> Any:
        if isinstance(node, dict):
            ref = node.get("$ref")
            if ref and ref.startswith("#/$defs/"):
                return resolve(dict(defs[ref.split("/")[-1]]))
            return {key: resolve(value) for key, value in node.items()}
        if isinstance(node, list):
            return [resolve(item) for item in node]
        return node

    return resolve(schema)


def render_ui_schema(plugin: str) -> dict[str, Any]:
    """The render_ui JSON schema with the block-type enum narrowed to this plugin's manifest."""
    schema = inline_schema(RenderUIParams.model_json_schema())
    schema["properties"]["blocks"]["items"]["properties"]["type"] = {
        "type": "string",
        "enum": ALLOWED_BLOCKS[plugin],
        "description": " ".join(BLOCK_GUIDE[b] for b in ALLOWED_BLOCKS[plugin]),
    }
    return schema


def govern(plugin: str, view: RenderUIParams) -> tuple[list[dict[str, Any]], int]:
    """Drop blocks outside the manifest. Returns (blocks, number_dropped)."""
    allowed = set(ALLOWED_BLOCKS[plugin])
    kept = [b.model_dump(exclude_none=True) for b in view.blocks if b.type in allowed]
    return kept, len(view.blocks) - len(kept)
