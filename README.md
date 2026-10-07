# Clinical Extensions – many innovations, few platforms

Interactive demo of [goal.md](goal.md): an **extensible clinical environment** where governed, contextual clinical
plugins sit on top of a resilient EMR, are activated **reactively** (Drasi-style continuous queries), run an
**agent loop on the GitHub Copilot SDK**, and render **generative UI** restricted to what their manifest approves.

> Hackathon prototype. All patients, reports, protocols and trials are synthetic. Not for clinical use.

**Live demo:** https://jochenvw.github.io/emr-extension/ (static build, scripted agents)

## Run

```powershell
npm install
npm run dev            # frontend → http://127.0.0.1:5180  (works standalone: scripted agents)
npm run dev:api        # optional backend → :8000 – live Copilot SDK agents (needs uv + signed-in Copilot CLI)
```

With the backend up, the control-plane console shows a **Copilot SDK / Scripted** toggle. `npm run serve` builds
the frontend and serves everything from FastAPI on :8000.

## What's in it

| Page | Purpose |
|---|---|
| **Story** | The problem in one clinical moment – the three bad choices hospitals have today. |
| **Demo** | The 4-minute guided demo (11 steps, ←/→ keys). EMR left, extension surface right, Drasi console bottom. |
| **Architecture** | Four planes + learning plane; trace the demo through them; kill the extension platform. |
| **Plugins** | Flip cards → manifests; `Plugin = data + workflow + UI + agent + activation + integration + contract`; genUI block catalogue. |
| **Deck** | The six slides from goal.md (`n` notes, `f` fullscreen). |

### Demo script (Demo page)

1. Clinician opens the chart → nothing happens (no context, no evidence).
2. Pathologist signs the biopsy → still quiet; the console shows the condition ticking.
3. Oncology review starts → `oncology-staging.activate` gains a row → plugin loads.
4. **Only now** the agent runs – once. Tool calls stream in (read reports → `ajcc_lung_stage` → `render_ui`).
5. Clinician reviews the genUI proposal, clicks evidence chips into the EMR, changes N1 → N2, confirms.
6. Write-back: rich record to the extension, essential subset to the EMR problem list; OMOP rows to the learning plane.
7. Next patient, cisplatin drafted with eGFR 41 → Medication Safety activates instead.
8. **Kill the extension platform** → the EMR keeps working; change events buffer.
9. Restore → buffered events replay, nothing lost.
10. Reveal: it was never an LLM watching the patient – clinical state is reactive.

Then: order the biomarker panel the staging agent flagged → results arrive → **Trial Matching** (depends on the
confirmed stage) activates. Plugin chaining through structured data.

## How it works

```
EMR change feed ─▶ continuous queries (Drasi) ─▶ result-set diff ─▶ registry + governance ─▶ plugin agent
                                                                                                 │
                         clinician confirms ◀─ generative UI (whitelisted blocks) ◀─ render_ui ◀──┘
                                 │
                                 └─▶ minimal write-back to EMR  +  full record to extension / OMOP
```

- **Reactive engine** – `src/engine/store.ts` is a pure reducer. EMR events update state; `queries.ts` re-evaluates
  continuous queries; a new row *activates* a plugin. LLM polling stays at zero.
- **Agent loop** – `backend/app/agents.py`: one `CopilotClient`, one session per activation. Each plugin brings its
  own skill (system prompt) and a **scoped tool set** (`tools.py`) bound to that activation's EMR snapshot.
  Clinical logic (AJCC 8 grouping, Cockcroft-Gault, protocol thresholds) is deterministic tools – the model
  extracts and explains, the rules compute.
- **Generative UI** – the agent never emits markup. It calls `render_ui` with typed blocks
  (`summary · stage_proposal · evidence · gap · alert · trend · options · trial_match`). Governance happens three
  times: the tool schema only offers the manifest's block types, the backend drops anything else, and the frontend
  (`src/agent/client.ts → governBlocks`) validates the interactive block, substituting a deterministic one if needed.
- **Streaming** – `POST /api/agent/{plugin}/stream` sends SSE events (`tool`, `result`, `error`) so the surface shows
  the loop live. Any failure falls back to the scripted agent with a visible note – the demo never breaks.
- **Scripted mode** – `src/agent/fallback.ts` is a deterministic stand-in with the same tools and block contract,
  used offline, when fast-forwarding the guide, and as fallback.

## Layout

```
src/engine/      reactive engine: types, plugins (manifests), queries, store, guide, staging
src/agent/       genUI contract, live SSE client + governance, run manager, scripted fallback
src/demo/        EMR (record plane), extension surface, control plane console, guide bar, genui/Blocks
src/pages/       Story, Architecture, Plugins, Deck
backend/app/     FastAPI: config, genui (contract), tools (scoped), agents (Copilot SDK), main
.verify/         Playwright walkthrough (MODE=scripted|live) and live SSE smoke test
```

## Hosting

- **GitHub Pages** (`.github/workflows/pages.yml`): every push to `main` builds with `VITE_STATIC=1` and deploys.
  No runtime, so agents run in scripted mode with the same tools, block contract and trace.
- **Live Copilot SDK agents** need the backend plus a Copilot identity, so they're not hosted publicly (a public
  endpoint would spend the owner's Copilot quota). Run `npm run serve` locally, or deploy the FastAPI app as a
  container (e.g. Azure Container Apps) with `COPILOT_GITHUB_TOKEN` as a secret behind authentication.

## Verify

```powershell
npm run build
npm run test:api
$env:MODE='live'; python .verify/walkthrough.py   # with dev + dev:api running; screenshots → .verify/shots/
```
