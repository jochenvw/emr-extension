import type { PluginId, Row, State } from './types';

export type Condition = { label: string; ok: boolean };

export type QueryDef = {
  id: string;
  plugin?: PluginId;
  title: string;
  cypher: string;
  /** Conditions for one patient – used for the live checklist. */
  conditions?: (s: State, patientId: string) => Condition[];
  rows: (s: State) => Row[];
};

const inContext = (s: State, pid: string) => s.context.patientId === pid;
const confirmed = (s: State, plugin: PluginId, pid: string) => s.sessions[`${plugin}:${pid}`]?.status === 'confirmed';

function rowsFrom(def: Omit<QueryDef, 'rows'>, summary: (s: State, pid: string) => string) {
  return (s: State): Row[] =>
    Object.keys(s.patients)
      .filter((pid) => def.conditions!(s, pid).every((c) => c.ok))
      .map((pid) => ({ key: `${def.id}:${pid}`, patientId: pid, summary: summary(s, pid) }));
}

const stagingDef: Omit<QueryDef, 'rows'> = {
  id: 'oncology-staging.activate',
  plugin: 'oncology-staging',
  title: 'Oncology Staging · activation',
  cypher: `MATCH (c:Clinician)-[:REVIEWING {workflow:'oncology-review'}]->(p:Patient),
      (p)-[:HAS]->(r:DiagnosticReport {kind:'pathology', status:'final'}),
      (p)-[:HAS]->(:DiagnosticReport {kind:'imaging'})
WHERE NOT (p)-[:HAS]->(:TumourStaging {status:'confirmed'})
RETURN p.id, r.id`,
  conditions: (s, pid) => {
    const p = s.patients[pid];
    return [
      { label: 'Final pathology report', ok: p.reports.some((r) => r.kind === 'pathology' && r.status === 'final') },
      { label: 'Imaging available', ok: p.reports.some((r) => r.kind === 'imaging' && r.status === 'final') },
      { label: 'No confirmed stage yet', ok: !confirmed(s, 'oncology-staging', pid) },
      { label: 'Clinician in oncology review', ok: inContext(s, pid) && s.context.workflow === 'oncology-review' },
    ];
  },
};

const medDef: Omit<QueryDef, 'rows'> = {
  id: 'medication-safety.activate',
  plugin: 'medication-safety',
  title: 'Medication Safety · activation',
  cypher: `MATCH (c:Clinician)-[:CHARTING]->(p:Patient),
      (p)-[:HAS]->(o:MedicationRequest {status:'draft', nephrotoxic:true}),
      (p)-[:HAS]->(l:Observation {code:'eGFR'})
WHERE l.isLatest AND l.value < 60
  AND NOT (o)-[:REVIEWED_BY]->(:SafetyReview)
RETURN p.id, o.id, l.value`,
  conditions: (s, pid) => {
    const p = s.patients[pid];
    const egfr = p.labs.find((l) => l.label.startsWith('eGFR'));
    const draft = p.meds.find((m) => m.nephrotoxic && m.status === 'draft');
    const anyNephro = p.meds.find((m) => m.nephrotoxic);
    return [
      { label: 'Nephrotoxic order in draft', ok: !!draft },
      { label: `Latest eGFR < 60${egfr ? ` (${egfr.value})` : ''}`, ok: !!egfr && Number(egfr.value) < 60 },
      { label: 'No safety review on order', ok: !!anyNephro ? !anyNephro.safetyReviewed : true },
      { label: 'Clinician charting this patient', ok: inContext(s, pid) },
    ];
  },
};

const trialDef: Omit<QueryDef, 'rows'> = {
  id: 'trial-matching.activate',
  plugin: 'trial-matching',
  title: 'Trial Matching · activation',
  cypher: `MATCH (c:Clinician)-[:CHARTING]->(p:Patient),
      (p)-[:HAS]->(st:TumourStaging {status:'confirmed'}),   // produced by another plugin
      (p)-[:HAS]->(b:Observation {panel:'NSCLC-biomarkers', status:'final'})
WHERE NOT (p)-[:FLAGGED_FOR]->(:TumourBoard)
RETURN p.id, st.stage, b.id`,
  conditions: (s, pid) => {
    const p = s.patients[pid];
    return [
      { label: 'Confirmed stage (from Oncology Staging)', ok: confirmed(s, 'oncology-staging', pid) },
      { label: 'Biomarker results final', ok: !!p.biomarkersResulted },
      { label: 'Not yet flagged for tumour board', ok: !p.trialFlagged },
      { label: 'Clinician charting this patient', ok: inContext(s, pid) },
    ];
  },
};

export const QUERIES: QueryDef[] = [
  { ...stagingDef, rows: rowsFrom(stagingDef, (_s, pid) => `{patient: ${pid}, report: PATH-26-4471}`) },
  {
    ...medDef,
    rows: rowsFrom(medDef, (s, pid) => {
      const egfr = s.patients[pid].labs.find((l) => l.label.startsWith('eGFR'));
      return `{patient: ${pid}, order: cisplatin, eGFR: ${egfr?.value}}`;
    }),
  },
  { ...trialDef, rows: rowsFrom(trialDef, (_s, pid) => `{patient: ${pid}, stage: confirmed, biomarkers: final}`) },
  {
    id: 'learning.omop-export',
    title: 'Learning plane · structured facts → OMOP',
    cypher: `MATCH (x)-[:WRITTEN_BY]->(:Plugin)
WHERE x.status = 'confirmed' AND NOT (x)-[:EXPORTED_TO]->(:OMOP)
RETURN x.id, labels(x)`,
    rows: (s) => s.extensionStore.map((r) => ({ key: `learning:${r.id}`, patientId: r.patientId, summary: `{record: ${r.id}, omop_rows: ${r.omopRows}}` })),
  },
];

export const pluginQuery = (plugin: PluginId) => QUERIES.find((q) => q.plugin === plugin)!;
