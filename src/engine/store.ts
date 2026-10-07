import { CLINICIAN, cockcroftGault, initialPatients, PATIENT_A } from '../data/patients';
import type { AgentOutcome } from '../agent/blocks';
import { PLUGINS } from './plugins';
import { QUERIES } from './queries';
import { lungStage, tnmString } from './staging';
import type { EmrView, LogEntry, LogKind, MedChoice, MedOrder, Patient, PluginId, PluginSession, State, TNM, Workflow } from './types';

export type Action =
  | { type: 'reset' }
  | { type: 'replace'; state: State }
  | { type: 'emr.view'; view: EmrView }
  | { type: 'emr.openPatient'; id: string }
  | { type: 'emr.showReport'; id: string }
  | { type: 'emr.evidence'; segment: string }
  | { type: 'emr.finalizePathology' }
  | { type: 'emr.startWorkflow'; workflow: Workflow }
  | { type: 'emr.draftCisplatin' }
  | { type: 'emr.resultBiomarkers' }
  | { type: 'agent.done'; plugin: PluginId; patientId: string; outcome: AgentOutcome }
  | { type: 'staging.edit'; key: keyof TNM; value: string }
  | { type: 'staging.toggleBiomarkers' }
  | { type: 'staging.confirm' }
  | { type: 'med.choose'; choice: MedChoice }
  | { type: 'med.reason'; reason: string }
  | { type: 'med.confirm' }
  | { type: 'trial.flag' }
  | { type: 'platform.kill' }
  | { type: 'platform.restore' }
  | { type: 'reveal'; open: boolean }
  | { type: 'notice'; text: string | null };

const BASE = 9 * 3600 + 12 * 60;
export const clockText = (clock: number) => {
  const t = BASE + clock;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(t / 3600))}:${p(Math.floor((t % 3600) / 60))}:${p(t % 60)}`;
};

export function initialState(): State {
  const s: State = {
    clock: 0,
    patients: initialPatients(),
    context: { patientId: null, workflow: null, visit: 0 },
    emrView: 'worklist',
    emrReport: null,
    highlight: null,
    platformUp: true,
    results: {},
    sessions: {},
    extensionStore: [],
    log: [],
    logSeq: 0,
    counters: { sourceEvents: 0, queryDiffs: 0, agentCalls: 0, buffered: 0, writebacks: 0 },
    reveal: false,
    notice: null,
  };
  const withLog = log(s, 'system', `Drasi: ${QUERIES.length} continuous queries registered · subscribed to EMR change feed`);
  return evaluate(withLog);
}

function log(s: State, kind: LogKind, text: string, extra: Partial<LogEntry> = {}): State {
  const entry: LogEntry = { id: s.logSeq + 1, t: clockText(s.clock), kind, text, ...extra };
  return { ...s, logSeq: s.logSeq + 1, log: [entry, ...s.log].slice(0, 120) };
}

const tick = (s: State, sec = 6): State => ({ ...s, clock: s.clock + sec });

const patch = (s: State, pid: string, fn: (p: Patient) => Patient): State => ({
  ...s,
  patients: { ...s.patients, [pid]: fn(s.patients[pid]) },
});

const sessionKey = (plugin: PluginId, pid: string) => `${plugin}:${pid}`;
const shortName = (p: Patient) => `${p.name.split(' ').slice(-1)[0]}, ${p.name[0]}.`;

/** A change in the record plane. While the platform is down, the change feed is buffered. */
function source(s: State, text: string, mutate: (s: State) => State): State {
  let next = mutate(tick(s));
  next = { ...next, counters: { ...next.counters, sourceEvents: next.counters.sourceEvents + 1 } };
  if (!next.platformUp) {
    next = log(next, 'source', `${text}  (buffered – platform offline)`, { muted: true });
    return { ...next, counters: { ...next.counters, buffered: next.counters.buffered + 1 } };
  }
  return evaluate(log(next, 'source', text));
}

/** Drasi: re-evaluate continuous queries, diff result sets, run reactions. */
function evaluate(s: State): State {
  if (!s.platformUp) return s;
  let next = s;
  const results: State['results'] = {};
  for (const q of QUERIES) {
    const rows = q.rows(next);
    const prev = next.results[q.id] ?? [];
    const prevKeys = new Set(prev.map((r) => r.key));
    const keys = new Set(rows.map((r) => r.key));
    results[q.id] = rows;
    for (const r of rows.filter((r) => !prevKeys.has(r.key))) {
      next = log(next, 'query', `${q.id}  ${r.summary}`, { sign: '+' });
      next = { ...next, counters: { ...next.counters, queryDiffs: next.counters.queryDiffs + 1 } };
      if (q.plugin) next = activate(next, q.plugin, r.patientId);
      else next = log(next, 'reaction', `learning plane ← queue OMOP rows for ${r.summary.match(/record: ([\w-]+)/)?.[1]}`);
    }
    for (const r of prev.filter((r) => !keys.has(r.key))) {
      next = log(next, 'query', `${q.id}  ${r.summary}`, { sign: '-' });
      next = { ...next, counters: { ...next.counters, queryDiffs: next.counters.queryDiffs + 1 } };
      if (q.plugin) {
        const done = next.sessions[sessionKey(q.plugin, r.patientId)]?.status === 'confirmed';
        next = log(next, 'reaction', `${done ? 'work complete → ' : ''}unload ${q.plugin} from experience plane`);
      }
    }
  }
  return { ...next, results };
}

function activate(s: State, plugin: PluginId, pid: string): State {
  const meta = PLUGINS[plugin];
  let next = log(s, 'reaction', `load ${plugin}@${meta.version} → experience plane (${shortName(s.patients[pid])})`);
  const key = sessionKey(plugin, pid);
  const existing = next.sessions[key];
  if (existing && existing.status !== 'confirmed') {
    next = log(next, 'reaction', `restore ${plugin} state – no new agent call`);
    return { ...next, sessions: { ...next.sessions, [key]: { ...existing, visit: next.context.visit } } };
  }
  const session: PluginSession = {
    plugin,
    patientId: pid,
    status: 'running',
    visit: next.context.visit,
    invokedAt: clockText(next.clock),
  };
  if (plugin === 'medication-safety') session.med = { choice: null, reason: '' };
  next = log(next, 'agent', `invoke ${meta.ai.toLowerCase()} – 1 call, scoped to ${shortName(next.patients[pid])}`);
  return {
    ...next,
    sessions: { ...next.sessions, [key]: session },
    counters: { ...next.counters, agentCalls: next.counters.agentCalls + 1 },
  };
}

function extWrite(s: State, text: string): State {
  const next = log(tick(s), 'source', text);
  return { ...next, counters: { ...next.counters, sourceEvents: next.counters.sourceEvents + 1 } };
}

function writeback(s: State, text: string): State {
  return { ...log(s, 'writeback', text), counters: { ...s.counters, writebacks: s.counters.writebacks + 1 } };
}

const today = '07.10.2026';

export function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'reset':
      return initialState();
    case 'replace':
      return a.state;
    case 'notice':
      return { ...s, notice: a.text };
    case 'reveal':
      return { ...s, reveal: a.open };
    case 'emr.view':
      return { ...s, emrView: a.view, highlight: a.view === 'results' ? s.highlight : null, notice: null };
    case 'emr.showReport':
      return { ...s, emrView: 'results', emrReport: a.id, highlight: null };
    case 'emr.evidence': {
      const pid = s.context.patientId;
      const report = pid && s.patients[pid].reports.find((r) => r.segments.some((g) => g.id === a.segment));
      if (!report) return s;
      return { ...s, emrView: 'results', emrReport: report.id, highlight: a.segment };
    }
    case 'emr.openPatient': {
      const p = s.patients[a.id];
      if (!p) return { ...s, notice: 'This chart is not part of the synthetic demo. Open Elisabeth Brandt or Thomas Keller.' };
      if (s.context.patientId === a.id) return { ...s, emrView: 'summary', notice: null };
      return source(s, `EMR · context → chart ${shortName(p)} (MRN ${p.mrn})`, (x) => ({
        ...x,
        context: { patientId: a.id, workflow: 'chart', visit: x.context.visit + 1 },
        emrView: 'summary',
        emrReport: p.reports[0]?.id ?? null,
        highlight: null,
        notice: null,
      }));
    }
    case 'emr.finalizePathology': {
      const p = s.patients[PATIENT_A];
      const r = p.reports.find((r) => r.id === 'PATH-26-4471');
      if (!r || r.status === 'final') return s;
      return source(s, 'EMR · DiagnosticReport PATH-26-4471 pending → final', (x) =>
        patch({ ...x, emrReport: 'PATH-26-4471' }, PATIENT_A, (pp) => ({
          ...pp,
          reports: pp.reports.map((rr) => (rr.id === 'PATH-26-4471' ? { ...rr, status: 'final', isNew: true } : rr)),
        })),
      );
    }
    case 'emr.startWorkflow': {
      const pid = s.context.patientId;
      if (!pid || s.context.workflow === a.workflow) return s;
      return source(s, `EMR · workflow → ${a.workflow} (${shortName(s.patients[pid])})`, (x) => ({
        ...x,
        context: { ...x.context, workflow: a.workflow },
      }));
    }
    case 'emr.draftCisplatin': {
      const pid = s.context.patientId;
      if (!pid || pid === PATIENT_A) return s;
      if (s.patients[pid].meds.some((m) => m.nephrotoxic)) return { ...s, emrView: 'orders' };
      const order: MedOrder = {
        id: 'MR-88213',
        drug: 'Cisplatin',
        dose: '100 mg/m² (186 mg)',
        route: 'IV, with hydration',
        schedule: 'day 1, 22, 43 – concurrent RT',
        status: 'draft',
        nephrotoxic: true,
        isNew: true,
      };
      return source(s, 'EMR · MedicationRequest MR-88213 cisplatin status: draft', (x) =>
        patch({ ...x, emrView: 'orders' }, pid, (p) => ({ ...p, meds: [order, ...p.meds] })),
      );
    }
    case 'emr.resultBiomarkers': {
      const p = s.patients[PATIENT_A];
      if (p.biomarkersResulted || !p.meds.some((m) => m.id === 'OR-BIO-1')) return s;
      return source(s, 'EMR · Observation panel NSCLC-biomarkers final (EGFR, ALK, PD-L1)', (x) =>
        patch(x, PATIENT_A, (pp) => ({
          ...pp,
          biomarkersResulted: true,
          meds: pp.meds.map((m) => (m.id === 'OR-BIO-1' ? { ...m, status: 'active', comment: 'Resulted 07.10.2026' } : m)),
          reports: [
            {
              id: 'MOL-26-1180',
              kind: 'molecular',
              title: 'Molecular pathology – NSCLC panel (block A1)',
              date: today,
              author: 'Dr. A. Lindner, Molecular Pathology',
              status: 'final',
              isNew: true,
              segments: [
                { id: 'mol-egfr', text: 'EGFR: exon 19 deletion detected (p.E746_A750del).' },
                { id: 'mol-alk', text: 'ALK / ROS1: no rearrangement detected. KRAS: wild type.' },
                { id: 'mol-pdl1', text: 'PD-L1 (22C3): tumour proportion score 30 %.' },
              ],
            },
            ...pp.reports,
          ],
        })),
      );
    }
    case 'agent.done': {
      const key = sessionKey(a.plugin, a.patientId);
      const sess = s.sessions[key];
      if (!sess || sess.status !== 'running') return s;
      const o = a.outcome;
      const next: PluginSession = { ...sess, status: 'review', outcome: o };
      if (a.plugin === 'oncology-staging') {
        const prop = o.blocks.find((b) => b.type === 'stage_proposal');
        const get = (k: string) => prop?.items.find((i) => i.label.trim().toUpperCase().startsWith(k))?.value?.replace(/^c/, '');
        const tnm = { T: get('T') ?? 'T2a', N: get('N') ?? 'N1', M: get('M') ?? 'M0' } as TNM;
        next.staging = { proposed: tnm, draft: { ...tnm }, orderBiomarkers: o.blocks.some((b) => b.type === 'gap') };
      }
      if (a.plugin === 'medication-safety') {
        const opts = o.blocks.find((b) => b.type === 'options');
        next.med = { choice: (opts?.items.find((i) => /recommend/i.test(i.detail ?? ''))?.value as MedChoice) ?? null, reason: '' };
      }
      const how = o.mode === 'copilot' ? `Copilot SDK${o.model ? ` (${o.model})` : ''}` : 'scripted agent';
      let out = log({ ...s, sessions: { ...s.sessions, [key]: next } }, 'agent', `${how} · ${o.trace.length} tool calls · render_ui → ${o.blocks.length} blocks`);
      if (o.note) out = log(out, 'system', `governance: ${o.note}`);
      return out;
    }
    case 'staging.edit':
    case 'staging.toggleBiomarkers': {
      const pid = s.context.patientId;
      const key = pid && sessionKey('oncology-staging', pid);
      const sess = key ? s.sessions[key] : undefined;
      if (!key || !sess?.staging || sess.status !== 'review') return s;
      const staging =
        a.type === 'staging.edit'
          ? { ...sess.staging, draft: { ...sess.staging.draft, [a.key]: a.value } }
          : { ...sess.staging, orderBiomarkers: !sess.staging.orderBiomarkers };
      return { ...s, sessions: { ...s.sessions, [key]: { ...sess, staging } } };
    }
    case 'staging.confirm': {
      const pid = s.context.patientId;
      const key = pid && sessionKey('oncology-staging', pid);
      const sess = key ? s.sessions[key] : undefined;
      if (!pid || !key || !sess?.staging || sess.status !== 'review' || !s.platformUp) return s;
      const { draft, proposed, orderBiomarkers } = sess.staging;
      const stage = lungStage(draft);
      const edited = (['T', 'N', 'M'] as const).filter((k) => draft[k] !== proposed[k]);
      let next: State = {
        ...s,
        sessions: { ...s.sessions, [key]: { ...sess, status: 'confirmed', confirmedAt: clockText(s.clock + 6) } },
        extensionStore: [
          ...s.extensionStore,
          {
            id: `TS-${String(s.extensionStore.length + 1).padStart(4, '0')}`,
            plugin: 'oncology-staging',
            patientId: pid,
            at: clockText(s.clock + 6),
            title: `TumourStaging · ${tnmString(draft)} · ${stage}`,
            fields: 23,
            omopRows: 6,
          },
        ],
      };
      next = extWrite(next, `EXT · TumourStaging written – 23 fields${edited.length ? `, clinician edited ${edited.join('/')}` : ''}`);
      next = patch(next, pid, (p) => ({
        ...p,
        problems: [
          {
            id: 'pa-new',
            text: `NSCLC, adenocarcinoma RUL – ${tnmString(draft)}, stage ${stage} (AJCC 8)`,
            since: today,
            source: `Oncology Staging v2.3 · confirmed ${CLINICIAN}`,
            isNew: true,
          },
          ...p.problems,
        ],
        meds: orderBiomarkers
          ? [
              {
                id: 'OR-BIO-1',
                drug: 'NSCLC biomarker panel – EGFR, ALK, ROS1, KRAS, PD-L1',
                dose: 'block A1',
                route: 'Molecular pathology',
                schedule: 'once',
                status: 'pending',
                isNew: true,
                comment: 'Requested via Oncology Staging',
              },
              ...p.meds,
            ]
          : p.meds,
      }));
      next = writeback(next, `→ EMR Condition: NSCLC ${tnmString(draft)} stage ${stage}`);
      if (orderBiomarkers) next = writeback(next, '→ EMR ServiceRequest: NSCLC biomarker panel');
      return evaluate(next);
    }
    case 'med.choose':
    case 'med.reason': {
      const pid = s.context.patientId;
      const key = pid && sessionKey('medication-safety', pid);
      const sess = key ? s.sessions[key] : undefined;
      if (!key || !sess?.med) return s;
      const med = a.type === 'med.choose' ? { ...sess.med, choice: a.choice } : { ...sess.med, reason: a.reason };
      return { ...s, sessions: { ...s.sessions, [key]: { ...sess, med } } };
    }
    case 'med.confirm': {
      const pid = s.context.patientId;
      const key = pid && sessionKey('medication-safety', pid);
      const sess = key ? s.sessions[key] : undefined;
      if (!pid || !key || !sess?.med?.choice || sess.status !== 'review' || !s.platformUp) return s;
      const p = s.patients[pid];
      const creat = Number(p.labs.find((l) => l.label === 'Creatinine')?.value ?? 1);
      const crcl = cockcroftGault(p.age, p.weightKg, creat, p.sex === 'F');
      const decision = {
        hold: 'hold – pharmacist + oncologist review requested',
        board: 'hold – alternative radiosensitiser to tumour board',
        override: `proceed – clinical override: ${sess.med.reason || 'no reason given'}`,
      }[sess.med.choice];
      let next: State = {
        ...s,
        sessions: { ...s.sessions, [key]: { ...sess, status: 'confirmed', confirmedAt: clockText(s.clock + 6) } },
        extensionStore: [
          ...s.extensionStore,
          {
            id: `SR-${String(s.extensionStore.length + 1).padStart(4, '0')}`,
            plugin: 'medication-safety',
            patientId: pid,
            at: clockText(s.clock + 6),
            title: `MedicationSafetyReview · cisplatin · ${sess.med.choice}`,
            fields: 14,
            omopRows: 2,
          },
        ],
      };
      next = patch(next, pid, (pp) => ({
        ...pp,
        meds: pp.meds.map((m) =>
          m.nephrotoxic
            ? {
                ...m,
                status: sess.med!.choice === 'override' ? 'pending' : 'on-hold',
                safetyReviewed: true,
                comment: `Safety review (Medication Safety v1.7): eGFR 41, CrCl ≈ ${crcl} mL/min. Decision: ${decision}. ${CLINICIAN}`,
              }
            : m,
        ),
      }));
      next = extWrite(next, 'EXT · MedicationSafetyReview written – 14 fields');
      next = writeback(next, `→ EMR MedicationRequest MR-88213: ${sess.med.choice === 'override' ? 'signed' : 'on hold'} + review note`);
      return evaluate(next);
    }
    case 'trial.flag': {
      const pid = s.context.patientId;
      const key = pid && sessionKey('trial-matching', pid);
      const sess = key ? s.sessions[key] : undefined;
      if (!pid || !key || !sess || sess.status !== 'review') return s;
      let next: State = {
        ...s,
        sessions: { ...s.sessions, [key]: { ...sess, status: 'confirmed', confirmedAt: clockText(s.clock + 6) } },
        extensionStore: [
          ...s.extensionStore,
          { id: `TM-${String(s.extensionStore.length + 1).padStart(4, '0')}`, plugin: 'trial-matching', patientId: pid, at: clockText(s.clock + 6), title: 'TrialScreening · LUNA-ADJ-03', fields: 11, omopRows: 1 },
        ],
      };
      next = patch(next, pid, (p) => ({
        ...p,
        trialFlagged: true,
        notes: [
          {
            id: 'tm-note',
            date: today,
            author: CLINICIAN,
            title: 'Tumour board – trial candidate',
            text: 'Candidate for LUNA-ADJ-03 (synthetic adjuvant EGFR-TKI study). Open eligibility item: ECOG to be confirmed. Discuss at thoracic tumour board 09.10.',
            source: 'Trial Matching v0.9',
            isNew: true,
          },
          ...p.notes,
        ],
      }));
      next = extWrite(next, 'EXT · TrialScreening written – 11 fields');
      next = writeback(next, '→ EMR Task: thoracic tumour board 09.10 – trial candidate');
      return evaluate(next);
    }
    case 'platform.kill': {
      if (!s.platformUp) return s;
      const next = log(tick(s, 3), 'system', '⏻ extension platform stopped – control + innovation planes offline');
      return { ...next, platformUp: false };
    }
    case 'platform.restore': {
      if (s.platformUp) return s;
      let next = log(tick(s, 3), 'system', `extension platform restored – replaying ${s.counters.buffered} buffered change events`);
      next = { ...next, platformUp: true, counters: { ...next.counters, buffered: 0 } };
      return evaluate(next);
    }
  }
}

/** Plugins visible in the extension surface for the current context. */
export function visiblePlugins(s: State): PluginSession[] {
  const pid = s.context.patientId;
  if (!pid || !s.platformUp) return [];
  return Object.values(s.sessions).filter((sess) => {
    if (sess.patientId !== pid) return false;
    const q = QUERIES.find((q) => q.plugin === sess.plugin)!;
    const active = (s.results[q.id] ?? []).some((r) => r.patientId === pid);
    return active || (sess.status === 'confirmed' && sess.visit === s.context.visit);
  });
}

/** What the agent receives: only the patient in context – the plugin's tools read from this snapshot. */
export function agentPayload(s: State, plugin: PluginId, pid: string) {
  const p = s.patients[pid];
  const stage = s.sessions[sessionKey('oncology-staging', pid)];
  return {
    plugin,
    workflow: s.context.workflow,
    clinician: CLINICIAN,
    patient: {
      id: p.id,
      name: p.name,
      sex: p.sex,
      age: p.age,
      weight_kg: p.weightKg,
      problems: p.problems.map((x) => x.text),
      reports: p.reports.filter((r) => r.status === 'final').map((r) => ({ id: r.id, kind: r.kind, title: r.title, date: r.date, segments: r.segments })),
      labs: p.labs.map(({ label, value, unit, date, flag }) => ({ label, value, unit, date, flag })),
      orders: p.meds.map(({ id, drug, dose, route, schedule, status }) => ({ id, drug, dose, route, schedule, status })),
      notes: p.notes.map(({ date, author, title, text }) => ({ date, author, title, text })),
    },
    confirmed_stage:
      stage?.status === 'confirmed' && stage.staging ? { tnm: tnmString(stage.staging.draft), stage: lungStage(stage.staging.draft) } : null,
  };
}