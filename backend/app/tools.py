"""Clinical tools exposed to plugin agents.

Every tool is a closure over the request payload – the EMR snapshot the control plane hands to the
plugin – so an agent can only see the patient and context it was activated for (least privilege).
Deterministic clinical logic (AJCC grouping, Cockcroft-Gault, protocol rules) lives in tools, never
in the model. All data and rules are synthetic and illustrative – not for clinical use.
"""

import json
from collections.abc import Callable
from typing import Any

from copilot import define_tool
from copilot.tools import Tool
from pydantic import BaseModel, Field

from app.genui import RenderUIParams, render_ui_schema

T_CATS = ["T1a", "T1b", "T1c", "T2a", "T2b", "T3", "T4"]
N_CATS = ["N0", "N1", "N2", "N3"]
M_CATS = ["M0", "M1a", "M1b", "M1c"]


def lung_stage(t: str, n: str, m: str) -> str:
    """Lung cancer stage group, AJCC/UICC 8th edition (illustrative implementation)."""
    if m == "M1c":
        return "IVB"
    if m in ("M1a", "M1b"):
        return "IVA"
    t3or4 = t in ("T3", "T4")
    if n == "N3":
        return "IIIC" if t3or4 else "IIIB"
    if n == "N2":
        return "IIIB" if t3or4 else "IIIA"
    if n == "N1":
        return "IIIA" if t3or4 else "IIB"
    return {"T1a": "IA1", "T1b": "IA2", "T1c": "IA3", "T2a": "IB", "T2b": "IIA", "T3": "IIB", "T4": "IIIA"}[t]


def cockcroft_gault(age: float, weight_kg: float, creatinine_mg_dl: float, female: bool) -> float:
    value = ((140 - age) * weight_kg) / (72 * creatinine_mg_dl)
    return round(value * (0.85 if female else 1.0), 1)


PROTOCOLS: dict[str, dict[str, Any]] = {
    "cisplatin": {
        "protocol": "Head & neck chemoradiation – local SOP v4 (synthetic)",
        "regimen": "Cisplatin 100 mg/m² IV q3w ×3, concurrent with 70 Gy / 35 fx",
        "requires": [
            "CrCl ≥ 60 mL/min (Cockcroft-Gault) for high-dose cisplatin",
            "Baseline audiogram",
            "Magnesium and electrolytes within range",
        ],
        "if_not_met": "Do not start high-dose cisplatin. Pharmacist + oncologist review; consider an alternative "
        "radiosensitiser via tumour board.",
        "interactions": ["Metformin: review dose when eGFR 30–45 mL/min/1.73m²", "Avoid concurrent nephrotoxins"],
    },
}

TRIALS: list[dict[str, Any]] = [
    {
        "id": "LUNA-ADJ-03",
        "title": "Adjuvant EGFR-TKI after complete resection",
        "phase": "III",
        "criteria": [
            "NSCLC stage IB–IIIA (AJCC 8)",
            "EGFR exon 19 deletion or L858R",
            "Complete (R0) resection",
            "ECOG 0–1",
        ],
    },
    {
        "id": "NEO-IO-22",
        "title": "Neoadjuvant chemo-immunotherapy, resectable NSCLC",
        "phase": "III",
        "criteria": ["NSCLC stage II–IIIB", "No EGFR / ALK alteration", "ECOG 0–1"],
    },
    {
        "id": "KRYSTAL-L11",
        "title": "KRAS G12C inhibitor, advanced NSCLC",
        "phase": "II",
        "criteria": ["NSCLC stage IV", "KRAS G12C mutation"],
    },
    {
        "id": "ORBIT-RT-07",
        "title": "Consolidation IO after chemoradiation",
        "phase": "III",
        "criteria": ["Unresectable stage III NSCLC", "PD-L1 ≥ 1%"],
    },
]
TRIAL_REGISTRY_SIZE = 14


class NoParams(BaseModel):
    pass


class ReportParams(BaseModel):
    report_id: str = Field(description="Report id from list_reports, e.g. 'PATH-26-4471'")


class StageParams(BaseModel):
    t: str = Field(description="T category, one of " + ", ".join(T_CATS))
    n: str = Field(description="N category, one of " + ", ".join(N_CATS))
    m: str = Field(description="M category, one of " + ", ".join(M_CATS))


class CrClParams(BaseModel):
    age: float
    weight_kg: float
    creatinine_mg_dl: float
    female: bool = False


class DrugParams(BaseModel):
    drug: str = Field(description="Generic drug name, e.g. 'cisplatin'")


class TrialSearchParams(BaseModel):
    stage: str = Field(description="Confirmed stage group, e.g. 'IIB'")
    biomarkers: str = Field(default="", description="Known driver alterations, e.g. 'EGFR exon 19 deletion'")


def _tool(name: str, description: str, handler: Callable[..., str], params: type[BaseModel] = NoParams) -> Tool:
    return define_tool(name, description=description, handler=handler, params_type=params, skip_permission=True)


def build_tools(payload: dict[str, Any]) -> dict[str, Tool]:
    """All tools, bound to one plugin activation's EMR snapshot."""
    patient = payload.get("patient") or {}
    reports = {r["id"]: r for r in patient.get("reports", [])}

    def get_context(_: NoParams) -> str:
        return json.dumps(
            {
                "workflow": payload.get("workflow"),
                "clinician": payload.get("clinician"),
                "patient": {k: patient.get(k) for k in ("id", "name", "sex", "age", "weight_kg", "problems")},
            }
        )

    def list_reports(_: NoParams) -> str:
        return json.dumps([{k: r.get(k) for k in ("id", "kind", "title", "date")} for r in reports.values()])

    def read_report(p: ReportParams) -> str:
        r = reports.get(p.report_id.strip())
        if not r:
            return f"No final report '{p.report_id}'. Available: {', '.join(reports) or 'none'}."
        lines = [f"[{s['id']}] {s['text']}" if s.get("id") else s["text"] for s in r.get("segments", [])]
        return f"{r['title']} ({r['date']})\nSegment ids in [brackets] can be cited as refs.\n" + "\n".join(lines)

    def get_labs(_: NoParams) -> str:
        return json.dumps(patient.get("labs", []))

    def get_orders(_: NoParams) -> str:
        return json.dumps(patient.get("orders", []))

    def get_notes(_: NoParams) -> str:
        return json.dumps(patient.get("notes", []))

    def ajcc_lung_stage(p: StageParams) -> str:
        t, n, m = (x.strip().removeprefix("c").removeprefix("p") for x in (p.t, p.n, p.m))
        if t not in T_CATS or n not in N_CATS or m not in M_CATS:
            return f"Invalid categories. T: {T_CATS}; N: {N_CATS}; M: {M_CATS}"
        return json.dumps({"tnm": f"c{t} c{n} c{m}", "stage": lung_stage(t, n, m), "edition": "AJCC/UICC 8th"})

    def crcl(p: CrClParams) -> str:
        value = cockcroft_gault(p.age, p.weight_kg, p.creatinine_mg_dl, p.female)
        return json.dumps({"crcl_ml_min": value, "formula": "Cockcroft-Gault", "weight_kg": p.weight_kg})

    def get_protocol(p: DrugParams) -> str:
        proto = PROTOCOLS.get(p.drug.strip().lower())
        return json.dumps(proto) if proto else f"No local protocol for '{p.drug}'."

    def get_confirmed_stage(_: NoParams) -> str:
        stage = payload.get("confirmed_stage")
        if not stage:
            return "No clinician-confirmed stage on record."
        return json.dumps({**stage, "source": "Oncology Staging plugin, confirmed by clinician"})

    def search_trials(p: TrialSearchParams) -> str:
        return json.dumps(
            {
                "screened": TRIAL_REGISTRY_SIZE,
                "query": {"stage": p.stage, "biomarkers": p.biomarkers},
                "note": f"{TRIAL_REGISTRY_SIZE} open thoracic studies at this site (synthetic). "
                f"{TRIAL_REGISTRY_SIZE - len(TRIALS)} excluded by registry pre-filter (disease site / setting); "
                f"{len(TRIALS)} returned for criterion-level review against the record.",
                "trials": TRIALS,
            }
        )

    tools = [
        _tool("get_context", "Workflow, clinician and patient demographics/problem list.", get_context),
        _tool("list_reports", "List final reports (pathology, imaging, molecular) for the patient.", list_reports),
        _tool("read_report", "Read one report. Segments carry citable [segment-id]s.", read_report, ReportParams),
        _tool("get_labs", "Laboratory results incl. dates and flags.", get_labs),
        _tool("get_orders", "Medication orders incl. drafts.", get_orders),
        _tool("get_notes", "Clinical notes (e.g. tumour board).", get_notes),
        _tool(
            "ajcc_lung_stage", "Deterministic AJCC 8 lung stage grouping from T, N, M.", ajcc_lung_stage, StageParams
        ),
        _tool("cockcroft_gault", "Creatinine clearance (mL/min) by Cockcroft-Gault.", crcl, CrClParams),
        _tool("get_protocol", "Local treatment protocol rules for a drug.", get_protocol, DrugParams),
        _tool(
            "get_confirmed_stage", "Clinician-confirmed stage from the Oncology Staging plugin.", get_confirmed_stage
        ),
        _tool("search_trials", "Search the site's open trial registry.", search_trials, TrialSearchParams),
    ]
    return {t.name: t for t in tools}


def build_render_ui_tool(plugin: str, sink: Callable[[RenderUIParams], None]) -> Tool:
    """Generative-UI tool. Its schema only offers the block types this plugin's manifest allows."""

    def render_ui(params: RenderUIParams) -> str:
        sink(params)
        return "Rendered on the clinical surface."

    tool = define_tool(
        "render_ui",
        description="Show your result on the clinical surface as typed UI blocks. Call exactly once, at the end.",
        handler=render_ui,
        params_type=RenderUIParams,
        skip_permission=True,
        is_terminal=True,
    )
    tool.parameters = render_ui_schema(plugin)
    return tool
