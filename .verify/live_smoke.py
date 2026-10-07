"""Smoke-test the live agent endpoint: POST a staging payload, print SSE events as they arrive."""

import json
import os
import sys
import time
import urllib.request

BASE = os.environ.get("API", "http://127.0.0.1:8000")
PLUGIN = sys.argv[1] if len(sys.argv) > 1 else "oncology-staging"

seg = lambda i, t: {"id": i, "text": t} if i else {"text": t}  # noqa: E731
payload = {
    "plugin": PLUGIN,
    "workflow": "oncology-review",
    "clinician": "Dr. M. Weber",
    "patient": {
        "id": "P-001",
        "name": "Anna Becker",
        "sex": "F",
        "age": 64,
        "weight_kg": 61,
        "problems": ["Suspected lung cancer, right upper lobe"],
        "reports": [
            {"id": "PATH-26-4471", "kind": "pathology", "title": "Histopathology – CT-guided core biopsy, RUL",
             "date": "07.10.2026", "segments": [
                seg(None, "Specimen: 3 cores, right upper lobe, CT-guided (A1–A3)."),
                seg("path-histo", "Invasive non-mucinous adenocarcinoma, acinar-predominant pattern."),
                seg("path-ihc", "Immunohistochemistry: TTF-1 positive, napsin A positive, p40 negative."),
                seg("path-mol", "Molecular testing (EGFR, ALK, ROS1, KRAS, PD-L1) not requested on this specimen."),
                seg(None, "Sufficient tumour tissue remains in block A1 for further testing.")]},
            {"id": "PET-26-0925", "kind": "imaging", "title": "FDG PET-CT", "date": "25.09.2026", "segments": [
                seg("pet-primary", "Intense FDG uptake in the right upper lobe mass (SUVmax 11.4)."),
                seg("pet-node", "FDG-avid right hilar node, station 10R (SUVmax 6.2), compatible with nodal involvement."),
                seg("pet-4r", "Mild uptake in station 4R (SUVmax 2.6), indeterminate."),
                seg("pet-m", "No FDG-avid distant metastases.")]},
            {"id": "CT-26-0918", "kind": "imaging", "title": "CT thorax", "date": "18.09.2026", "segments": [
                seg("ct-size", "Spiculated mass in the right upper lobe measuring 3.6 × 2.9 cm."),
                seg("ct-pleura", "The lesion abuts but does not invade the visceral pleura; no chest-wall involvement."),
                seg("ct-node", "Enlarged right hilar lymph node (station 10R), short axis 14 mm."),
                seg("ct-m", "No pleural effusion. Liver and adrenal glands unremarkable. No osseous lesions.")]},
        ],
        "labs": [],
        "orders": [],
        "notes": [],
    },
    "confirmed_stage": None,
}

req = urllib.request.Request(
    f"{BASE}/api/agent/{PLUGIN}/stream", data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"}
)
t0 = time.time()
with urllib.request.urlopen(req, timeout=120) as res:
    for raw in res:
        line = raw.decode().strip()
        if line.startswith("data:"):
            ev = json.loads(line[5:])
            if ev["type"] == "result":
                print(f"[{time.time() - t0:5.1f}s] RESULT {ev['headline']}")
                print(json.dumps(ev["blocks"], indent=1, ensure_ascii=False)[:3000])
            else:
                print(f"[{time.time() - t0:5.1f}s] {ev}")
