import type { PluginId } from './types';

export type PluginMeta = {
  id: PluginId;
  name: string;
  version: string;
  owner: string;
  icon: string;
  hue: string;
  status: 'APPROVED' | 'PILOT';
  activates: string;
  reads: string;
  adds: string;
  ai: string;
  clinician: string;
  writesBack: string;
  degradation: string;
  permissions: string[];
  dependsOn?: string;
  manifest: string;
};

export const PLUGINS: Record<PluginId, PluginMeta> = {
  'oncology-staging': {
    id: 'oncology-staging',
    name: 'Oncology Staging',
    version: '2.3',
    owner: 'Thoracic Oncology',
    icon: '🫁',
    hue: '#ff6fa8',
    status: 'APPROVED',
    activates: 'New pathology + oncology review context',
    reads: 'Pathology / Imaging / Diagnosis',
    adds: 'Tumour / TNM / Stage / Evidence',
    ai: 'Stage-extraction agent',
    clinician: 'Review + confirm',
    writesBack: 'Confirmed stage summary → EMR',
    degradation: 'EMR remains available without plugin',
    permissions: ['read: DiagnosticReport', 'read: Condition', 'write: Condition (summary)', 'write: ServiceRequest'],
    manifest: `oncology-staging:
  version: 2.3
  owner: thoracic-oncology

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
    loop: github-copilot-sdk
    skill: stage-extraction
    tools: [read_report, ajcc_lung_stage]

  ui:            # generative UI – agent may only compose these
    blocks: [stage_proposal, evidence, gap, alert, summary]

  writeback:
    emr: confirmed-stage-summary

  fallback:
    emr_retains: minimum-clinical-record`,
  },
  'medication-safety': {
    id: 'medication-safety',
    name: 'Medication Safety',
    version: '1.7',
    owner: 'Clinical Pharmacy',
    icon: '💊',
    hue: '#ffc257',
    status: 'APPROVED',
    activates: 'Nephrotoxic order drafted + impaired renal function',
    reads: 'Orders / Labs / Weight / Protocol',
    adds: 'Safety review / Decision / Rationale',
    ai: 'Renal-dosing review agent',
    clinician: 'Choose action + sign',
    writesBack: 'Order status + review comment → EMR',
    degradation: 'EMR order checks remain active',
    permissions: ['read: MedicationRequest', 'read: Observation', 'write: MedicationRequest.note'],
    manifest: `medication-safety:
  version: 1.7
  owner: clinical-pharmacy

  requires:
    - medication-orders
    - labs

  activates_when:
    order: nephrotoxic, status=draft
    lab: eGFR < 60

  provides:
    - safety-review
    - decision

  agent:
    loop: github-copilot-sdk
    skill: renal-dosing-review
    tools: [get_labs, cockcroft_gault, get_protocol]

  ui:
    blocks: [alert, trend, options, evidence, summary]

  writeback:
    emr: order-hold + review-note

  fallback:
    emr_retains: native-order-checks`,
  },
  'trial-matching': {
    id: 'trial-matching',
    name: 'Trial Matching',
    version: '0.9',
    owner: 'Clinical Trials Office',
    icon: '🧪',
    hue: '#8b7bff',
    status: 'PILOT',
    activates: 'Confirmed stage + biomarker results',
    reads: 'Stage / Biomarkers / Trial registry',
    adds: 'Candidate trials / Eligibility gaps',
    ai: 'Eligibility-screening agent',
    clinician: 'Flag for tumour board',
    writesBack: 'Tumour-board flag → EMR',
    degradation: 'Trials office manual screening',
    permissions: ['read: Condition', 'read: Observation', 'write: Task'],
    dependsOn: 'oncology-staging ≥ 2.0 (confirmed stage)',
    manifest: `trial-matching:
  version: 0.9
  owner: clinical-trials-office

  requires:
    - oncology-staging.stage   # another plugin's output
    - biomarkers

  activates_when:
    stage: confirmed
    biomarkers: resulted

  provides:
    - trial-candidates
    - eligibility-gaps

  agent:
    loop: github-copilot-sdk
    skill: eligibility-screening
    tools: [get_confirmed_stage, search_trials]

  ui:
    blocks: [trial_match, gap, evidence, summary]

  writeback:
    emr: tumour-board-flag

  fallback:
    emr_retains: nothing-lost (advisory)`,
  },
};

export const PLUGIN_ORDER: PluginId[] = ['oncology-staging', 'medication-safety', 'trial-matching'];
