import type { PluginId } from '../engine/types';
import type { AgentOutcome, GenBlock, TraceStep } from './blocks';

/* Deterministic stand-in for the Copilot SDK agent: same tools, same block contract.
   Used when the backend is unavailable, in "scripted" mode, and when fast-forwarding the guide. */

const STAGING_BLOCKS: GenBlock[] = [
  {
    type: 'stage_proposal',
    title: 'Proposed clinical stage',
    body: 'Adenocarcinoma, acinar-predominant (TTF-1+), right upper lobe.',
    items: [
      { label: 'T', value: 'T2a', confidence: 0.93, detail: 'Largest dimension 3.6 cm (> 3 – ≤ 4 cm); visceral pleura not invaded.', refs: ['ct-size', 'ct-pleura'] },
      {
        label: 'N',
        value: 'N1',
        confidence: 0.71,
        detail: 'Ipsilateral hilar node 10R enlarged and FDG-avid. Station 4R indeterminate.',
        refs: ['ct-node', 'pet-node', 'pet-4r'],
        severity: 'warning',
      },
      { label: 'M', value: 'M0', confidence: 0.95, detail: 'No distant disease on PET-CT; brain MRI negative.', refs: ['pet-m', 'mri-m', 'ct-m'] },
    ],
  },
  {
    type: 'alert',
    title: 'N2 not excluded',
    severity: 'warning',
    body: 'Station 4R is 9 mm with mild uptake (SUVmax 2.6). Consider EBUS-TBNA of 4R before the treatment decision.',
    items: [{ label: '4R on PET-CT', refs: ['pet-4r'] }],
  },
  {
    type: 'gap',
    title: 'Biomarkers not requested',
    severity: 'warning',
    body: 'EGFR · ALK · ROS1 · KRAS · PD-L1 are needed for peri-operative treatment selection. Tissue remains in block A1.',
    items: [{ label: 'Order NSCLC biomarker panel on block A1', value: 'order-biomarkers', refs: ['path-mol'] }],
  },
  {
    type: 'evidence',
    title: 'Histology',
    items: [
      { label: 'Invasive adenocarcinoma, acinar-predominant', refs: ['path-histo'] },
      { label: 'TTF-1+, napsin A+, p40−', refs: ['path-ihc'] },
    ],
  },
];

const MED_BLOCKS: GenBlock[] = [
  {
    type: 'alert',
    title: 'Cisplatin 100 mg/m² with declining renal function',
    severity: 'critical',
    body: 'Estimated CrCl ≈ 49 mL/min (Cockcroft-Gault, 74 kg). Local H&N protocol v4 requires CrCl ≥ 60 mL/min for high-dose cisplatin.',
    items: [],
  },
  {
    type: 'trend',
    title: 'eGFR – last 6 weeks (mL/min/1.73m²)',
    items: [
      { label: '25.08', value: '64' },
      { label: '15.09', value: '53' },
      { label: '06.10', value: '41' },
    ],
  },
  {
    type: 'evidence',
    title: 'Also noticed',
    items: [
      { label: 'Metformin 2 g/day with eGFR 41', detail: 'Review dose for eGFR 30–45.' },
      { label: 'No baseline audiogram on file', detail: 'Tumour board asked for audiometry before start.' },
    ],
  },
  {
    type: 'options',
    title: 'Your decision',
    items: [
      { label: 'Hold order – request pharmacist + oncologist review', value: 'hold', detail: 'Recommended' },
      { label: 'Hold – take alternative radiosensitiser to tumour board', value: 'board' },
      { label: 'Proceed – clinical override (reason required)', value: 'override' },
    ],
  },
];

const TRIAL_BLOCKS: GenBlock[] = [
  {
    type: 'trial_match',
    title: 'LUNA-ADJ-03 · adjuvant EGFR-TKI (synthetic)',
    body: '14 open thoracic studies screened · 1 candidate · 13 excluded.',
    items: [
      { label: 'NSCLC stage IB–IIIA', status: 'met', detail: 'Stage from Oncology Staging (confirmed)' },
      { label: 'EGFR exon 19 del or L858R', status: 'met', detail: 'Exon 19 deletion', refs: ['mol-egfr'] },
      { label: 'Complete (R0) resection', status: 'unknown', detail: 'Surgery not yet performed' },
      { label: 'ECOG 0–1', status: 'met', detail: 'ECOG 1 (19.09.2026)' },
    ],
  },
  {
    type: 'gap',
    title: 'Open eligibility item',
    severity: 'info',
    body: 'Eligibility can only be confirmed after resection. Flag now so the tumour board can plan surgery timing.',
    items: [],
  },
];

const TRACES: Record<PluginId, TraceStep[]> = {
  'oncology-staging': [
    { tool: 'get_context', args: '{}' },
    { tool: 'list_reports', args: '{}' },
    { tool: 'read_report', args: '{"report_id":"PATH-26-4471"}' },
    { tool: 'read_report', args: '{"report_id":"CT-26-0918"}' },
    { tool: 'read_report', args: '{"report_id":"PET-26-0925"}' },
    { tool: 'read_report', args: '{"report_id":"MRI-26-0926"}' },
    { tool: 'ajcc_lung_stage', args: '{"t":"T2a","n":"N1","m":"M0"} → IIB' },
    { tool: 'render_ui', args: '4 blocks: stage_proposal, alert, gap, evidence' },
  ],
  'medication-safety': [
    { tool: 'get_context', args: '{}' },
    { tool: 'get_orders', args: '{}' },
    { tool: 'get_labs', args: '{}' },
    { tool: 'cockcroft_gault', args: '{"age":58,"weight_kg":74,"creatinine_mg_dl":1.71} → 49' },
    { tool: 'get_protocol', args: '{"drug":"cisplatin"}' },
    { tool: 'render_ui', args: '4 blocks: alert, trend, evidence, options' },
  ],
  'trial-matching': [
    { tool: 'get_context', args: '{}' },
    { tool: 'get_confirmed_stage', args: '{}' },
    { tool: 'read_report', args: '{"report_id":"MOL-26-1180"}' },
    { tool: 'search_trials', args: '{"stage":"IIB","egfr":"ex19del"}' },
    { tool: 'render_ui', args: '2 blocks: trial_match, gap' },
  ],
};

const HEADLINES: Record<PluginId, string> = {
  'oncology-staging': 'cT2a cN1 cM0 – stage IIB proposed; N uncertain; biomarkers missing',
  'medication-safety': 'High-dose cisplatin conflicts with current renal function',
  'trial-matching': '1 candidate trial; 1 open eligibility item',
};

export const scriptedTrace = (plugin: PluginId) => TRACES[plugin];

export function scriptedOutcome(plugin: PluginId, ms = 0): AgentOutcome {
  const blocks = { 'oncology-staging': STAGING_BLOCKS, 'medication-safety': MED_BLOCKS, 'trial-matching': TRIAL_BLOCKS }[plugin];
  return { mode: 'scripted', headline: HEADLINES[plugin], blocks, trace: TRACES[plugin], ms };
}

export const fallbackBlock = (plugin: PluginId, type: GenBlock['type']) => scriptedOutcome(plugin).blocks.find((b) => b.type === type);
