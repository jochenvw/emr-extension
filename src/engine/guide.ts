import { scriptedOutcome } from '../agent/fallback';
import { PATIENT_A, PATIENT_B } from '../data/patients';
import { reducer, initialState, type Action } from './store';
import type { State } from './types';

export type GuideStep = {
  id: string;
  title: string;
  headline: string;
  explain: string;
  /** Label of the Next button that leads INTO this step. */
  cta: string;
  enter: Action[];
  /** When true at the current step, the guide moves on by itself (clinician did it manually). */
  advanceWhen?: (s: State) => boolean;
  /** Can the presenter leave this step yet? */
  ready?: (s: State) => boolean;
  waitLabel?: string;
};

export const GUIDE: GuideStep[] = [
  {
    id: 'start',
    title: 'Clinic morning',
    headline: 'An ordinary EMR. An extension surface that stays quiet.',
    explain:
      'Left: the hospital’s EMR – the resilient record. Right: the clinical extension surface. Watch when it speaks, and when it doesn’t.',
    cta: 'Restart',
    enter: [{ type: 'reset' }],
    advanceWhen: (s) => s.context.patientId === PATIENT_A,
  },
  {
    id: 'open',
    title: 'Open patient',
    headline: 'Clinician opens the chart. Nothing happens.',
    explain:
      'Dr. Weber opens Elisabeth Brandt. No capability is relevant yet, so nothing appears – and no AI is watching the chart.',
    cta: 'Open Elisabeth Brandt',
    enter: [{ type: 'emr.openPatient', id: PATIENT_A }],
    advanceWhen: (s) => s.patients[PATIENT_A].reports.some((r) => r.id === 'PATH-26-4471' && r.status === 'final'),
  },
  {
    id: 'evidence',
    title: 'New evidence',
    headline: 'The biopsy result lands. Still quiet.',
    explain:
      'The pathologist signs the report. Look at the control plane below: the staging plugin’s activation condition is now 3 of 4 satisfied. Not every new result deserves an interruption.',
    cta: 'Pathologist signs report',
    enter: [{ type: 'emr.showReport', id: 'PATH-26-4471' }, { type: 'emr.finalizePathology' }],
    advanceWhen: (s) => s.context.workflow === 'oncology-review',
  },
  {
    id: 'activate',
    title: 'Plugin wakes',
    headline: 'Context + evidence = relevance. The plugin wakes up.',
    explain:
      'Dr. Weber starts an oncology review. The last condition turns true, the query result set changes, and Oncology Staging appears – with the reason why.',
    cta: 'Start oncology review',
    enter: [{ type: 'emr.startWorkflow', workflow: 'oncology-review' }],
  },
  {
    id: 'agent',
    title: 'Agent works',
    headline: 'Only now is the agent invoked. Once.',
    explain:
      'It reads pathology, imaging and diagnosis, extracts T, N and M with evidence, applies a deterministic AJCC rule table – and notices what is missing.',
    cta: 'Watch the agent',
    enter: [],
    ready: (s) => s.sessions[`oncology-staging:${PATIENT_A}`]?.status !== 'running',
    waitLabel: 'Agent working…',
  },
  {
    id: 'confirm',
    title: 'Clinician decides',
    headline: 'The clinician confirms or modifies. Structured data, not a chat answer.',
    explain:
      'Click any evidence chip to see the source sentence in the EMR. The agent flags N as uncertain (station 4R) – change N1 → N2 and watch the stage regroup. Then confirm.',
    cta: 'Review the proposal',
    enter: [{ type: 'emr.evidence', segment: 'pet-4r' }],
    advanceWhen: (s) => s.sessions[`oncology-staging:${PATIENT_A}`]?.status === 'confirmed',
  },
  {
    id: 'writeback',
    title: 'Write-back',
    headline: 'Rich record to the extension. Essential subset to the EMR.',
    explain:
      'Tumour, TNM, evidence and provenance go to the extension store (and on to the learning plane). The clinically essential summary is written back to the EMR problem list.',
    cta: 'Confirm & sign',
    enter: [{ type: 'staging.confirm' }, { type: 'emr.view', view: 'summary' }],
    advanceWhen: (s) => s.context.patientId === PATIENT_B && s.patients[PATIENT_B].meds.some((m) => m.nephrotoxic),
  },
  {
    id: 'switch',
    title: 'Change context',
    headline: 'New patient, new workflow – a different capability.',
    explain:
      'Thomas Keller: cisplatin drafted while eGFR is 41. Oncology Staging is gone; Medication Safety becomes relevant instead. Same surface, different plugin, same governance.',
    cta: 'Next patient: draft cisplatin',
    enter: [{ type: 'emr.openPatient', id: PATIENT_B }, { type: 'emr.view', view: 'orders' }, { type: 'emr.draftCisplatin' }],
    advanceWhen: (s) => !s.platformUp,
  },
  {
    id: 'kill',
    title: 'Kill the platform',
    headline: 'Pull the plug on the entire extension platform.',
    explain:
      'Control plane, plugins, agents – all gone. The EMR keeps working. Clinical changes are buffered on the change feed, not lost.',
    cta: '⏻ Kill extension platform',
    enter: [{ type: 'platform.kill' }],
    advanceWhen: (s) => !s.platformUp && s.context.patientId === PATIENT_A,
  },
  {
    id: 'resilient',
    title: 'EMR still holds',
    headline: 'Medicine does not stop because a hackathon project crashed.',
    explain:
      'Back to Elisabeth Brandt: the confirmed stage and the biomarker order are in the EMR. The fancy capability is gone; the clinically essential result is not.',
    cta: 'Back to Elisabeth Brandt',
    enter: [{ type: 'emr.openPatient', id: PATIENT_A }, { type: 'emr.view', view: 'summary' }],
  },
  {
    id: 'reveal',
    title: 'The reveal',
    headline: 'What you just saw wasn’t an LLM watching the patient.',
    explain: 'Clinical state is reactive. Drasi maintains the conditions under which a capability becomes relevant. Only then do we invoke the plugin and agent.',
    cta: 'Reveal',
    enter: [{ type: 'reveal', open: true }],
  },
];

/** Deterministically rebuild the state for step `k`: earlier agents complete, step k's agents still run. */
export function stateAtStep(k: number): State {
  let s = initialState();
  for (let i = 1; i <= k; i++) {
    if (i === k && !GUIDE[k].ready) s = finishAgents(s);
    for (const a of GUIDE[i].enter) s = reducer(s, a);
  }
  return s;
}

function finishAgents(s: State): State {
  let next = s;
  for (const sess of Object.values(s.sessions)) {
    if (sess.status === 'running') next = reducer(next, { type: 'agent.done', plugin: sess.plugin, patientId: sess.patientId, outcome: scriptedOutcome(sess.plugin, 4200) });
  }
  return next;
}
