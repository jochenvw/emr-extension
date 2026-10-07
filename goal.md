I would not choose between **demo, deck, and narrative**. They should do different jobs.

For a hackathon, I would make the **demo the proof**, the **narrative the argument**, and the **deck the compression mechanism**. The architecture should appear only after people understand why it needs to exist.

### Start with a clinical moment, not the platform

The strongest opening is probably something like:

> A clinician is treating an oncology patient. There is information the hospital would like to capture and use—tumor state, treatment intent, response, biomarkers, AI-derived interpretation—but the EMR does not represent it well.
>
> Today the hospital has three choices: wait for the EMR vendor, build a separate application, or leave the information in notes.
>
> All three are bad.
>
> What if the hospital could extend its clinical environment the way modern software platforms are extended—with governed, contextual clinical plugins?

Then show it.

The audience should understand the problem **before hearing Drasi, FHIR, OMOP, canonical models, agents, or plugin manifests**.

## The demo I would build

A fake EMR is completely acceptable. In fact, it may communicate the concept better than wrestling with a real Epic/HiX integration.

Have a simple “HiX/Epic” patient screen on the left and your clinical extension surface on the right.

1. **Clinician opens patient.** Nothing happens. The extension surface is quiet.

2. **Clinician enters a relevant context.** For example, prescribing cisplatin for a patient with impaired renal function, or reviewing a newly diagnosed lung cancer case.

3. **The plugin wakes up automatically.** Drasi detects that the clinical state now satisfies the plugin's activation condition. The relevant oncology capability appears.

4. **Agent does useful work.** It combines the available data and proposes something meaningful: stage, treatment-line classification, missing biomarker, medication concern, etc.

5. **Clinician confirms or modifies it.** This is important. The demo should visibly create *better structured clinical information*, not merely produce an AI answer.

6. **Show where the result goes.** Rich structured information goes into the extension model; the clinically important subset is written back to the mock EMR.

7. **Change context.** Move to another patient or workflow. The oncology plugin disappears and perhaps another plugin becomes applicable. This demonstrates the reactive/plugin model far better than a diagram.

8. **Kill the extension platform.** This could be the killer final 20 seconds. The fancy capability disappears, but the EMR still contains the clinically essential result. The hospital hasn't created a dependency where medicine stops because your hackathon project crashed.

That one demo communicates **reactive programming, contextual activation, extensible data, agents, clinician-in-the-loop, write-back, plugin architecture, and graceful degradation** without explaining most of them.

Drasi should almost be the reveal:

> “What you just saw wasn't an LLM constantly watching the patient. Clinical state is reactive. Drasi maintains the conditions under which a capability becomes relevant. Only then do we invoke the plugin and agent.”

That makes the technology feel necessary rather than decorative.

## Then give them the architecture

I think we now have a clearer architecture vocabulary than “federated data platform.”

I would draw four horizontal planes:

```text
┌───────────────────────────────────────────────────────────┐
│                    EXPERIENCE PLANE                       │
│      One clinical surface — contextual capabilities      │
├───────────────────────────────────────────────────────────┤
│                    INNOVATION PLANE                       │
│   Oncology     Genomics     Medication     Pathology      │
│    plugin       plugin        plugin         plugin       │
│          Agents + UI + data + workflow                    │
├───────────────────────────────────────────────────────────┤
│                     CONTROL PLANE                         │
│ Context │ Drasi │ Auth │ Audit │ Registry │ Deployment    │
│ Observability │ Validation │ Versioning │ Governance      │
├───────────────────────────────────────────────────────────┤
│                      RECORD PLANE                         │
│               Epic / HiX / incumbent EMR                  │
│          resilient clinical system of record             │
└───────────────────────────────────────────────────────────┘
                         │
                         ▼
              LEARNING / DATA PLANE
        OMOP │ research │ AI │ federation │ analytics
```

There is a powerful conceptual separation here:

**Record plane:** what must continue working.

**Innovation plane:** what should be able to evolve quickly.

**Learning plane:** where the accumulated information becomes useful at scale.

**Control plane:** what stops rapid innovation from becoming chaos.

That last one addresses the “100 little apps” objection.

## Your deck could be only six slides

I would resist producing a 20-slide architecture presentation.

**Slide 1 — “AI cannot use information the hospital never captured.”**

Show the upstream bottleneck.

```text
EMR constraints
      ↓
information not captured / trapped in prose
      ↓
poor data
      ↓
limited agents + limited research
```

**Slide 2 — “The current alternatives don't scale.”**

```text
Option A                    Option B

Put everything             Build 100
in the EMR                 point solutions

     ↓                          ↓

vendor dependency          operational chaos
slow innovation            fragmented UX
```

Then put the desired middle ground between them:

> **Many innovations. Few platforms.**

I think that phrase is worth keeping.

**Slide 3 — “Make the clinical environment extensible.”**

Show the four-plane architecture above. Keep implementation names off this slide.

**Slide 4 — Demo.**

Very little text. Let the demo carry this section.

**Slide 5 — “What is a clinical plugin?”**

This is where I would show your manifest:

```yaml
oncology-staging:
  requires:
    - pathology
    - imaging
    - diagnosis

  activates_when:
    workflow: oncology-review
    evidence: new

  provides:
    - tumor
    - stage
    - evidence

  agent:
    - stage-extraction

  ui:
    - staging-panel

  writeback:
    emr: confirmed-stage-summary

  fallback:
    emr_retains: minimum-clinical-record
```

Then:

```text
Plugin =
    data
  + workflow
  + UI
  + agent
  + activation
  + integration
  + operational contract
```

That is much more memorable than a database schema.

**Slide 6 — “From data exhaust to a learning health system.”**

This closes the loop:

```text
Extensible clinical environment
            ↓
better information capture
            ↓
better clinical data
       ┌────┴────┐
       ▼         ▼
    Type 1     Type 2
   clinical   research
    agents      / AI
       │         │
       └────┬────┘
            ▼
    validated innovation
            │
            └──────────────► back into workflow
```

That reconnects the idea to where your project originally started: the federated data platform hasn't disappeared. **It has moved downstream into a larger system.**

## One additional artifact could be unusually effective

Make a **“clinical plugin card.”**

Not another architecture diagram. Something that looks like an actual product/package:

```text
┌──────────────────────────────────────────────┐
│ ONCOLOGY STAGING                    v2.3     │
│                                              │
│ Owner        Thoracic Oncology               │
│                                              │
│ ACTIVATES                                    │
│ New pathology + oncology review context      │
│                                              │
│ READS                                        │
│ Pathology / Imaging / Diagnosis              │
│                                              │
│ ADDS                                         │
│ Tumor / TNM / Stage / Evidence               │
│                                              │
│ AI                                           │
│ Stage extraction agent                       │
│                                              │
│ CLINICIAN                                    │
│ Review + confirm                             │
│                                              │
│ WRITES BACK                                  │
│ Confirmed stage summary → EMR                │
│                                              │
│ DEGRADATION                                  │
│ EMR remains available without plugin         │
│                                              │
│ STATUS              ✓ APPROVED               │
└──────────────────────────────────────────────┘
```

Then put two or three next to each other:

```text
Oncology Staging     Medication Safety     Trial Matching
      │                     │                    │
      └─────────────────────┼────────────────────┘
                            ▼
                 CLINICAL EXTENSION RUNTIME
```

Suddenly “plugin architecture for healthcare” becomes tangible.

It also provokes exactly the useful questions: Who approves these? Who owns them? What permissions do they get? How are they upgraded? Can one depend on another? What happens when one fails? How is it validated?

Those questions help rather than hurt, because they move the discussion from **“cool AI demo”** to **“could a hospital actually operate this?”**

## There is also a stronger narrative hiding here

I think the story of your own project evolution is actually worth telling:

> **We started by trying to solve the downstream problem: how do we federate hospital data so agents and researchers can use it?**
>
> **Then we discovered an upstream problem: hospitals often don't have the information we want to federate.**
>
> **And that led to a deeper question: why is it so difficult for a hospital to extend what its clinical systems can capture and do?**
>
> **So instead of only building a better data platform, we started asking what an extensible clinical platform would look like.**

Then the reveal:

> **The EMR remains the resilient record. The extension platform becomes the innovation surface. The data platform becomes the learning surface.**

That is probably your core narrative.

And Drasi gives you a particularly good **technical demonstration of one novel part of that thesis**: clinical capabilities can be *reactively activated by state*, rather than turning the EMR into a launcher for dozens of disconnected applications.

If time is limited, I would put roughly **60% of the effort into one excellent 3–4 minute clinical demo, 25% into the six-slide narrative, and 15% into one polished architecture/plugin visual**. The demo creates belief; the narrative explains why it matters; the architecture shows that you have thought beyond the demo.