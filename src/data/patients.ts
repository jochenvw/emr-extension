import type { Patient } from '../engine/types';

/* Synthetic patients only. Clinical content is plausible but illustrative – not for clinical use. */

export const PATIENT_A = 'P-A';
export const PATIENT_B = 'P-B';

export const initialPatients = (): Record<string, Patient> => ({
  [PATIENT_A]: {
    id: PATIENT_A,
    mrn: '00481237',
    name: 'Elisabeth Brandt',
    sex: 'F',
    born: '14.03.1962',
    age: 64,
    weightKg: 61,
    ward: 'Thoracic Oncology Clinic',
    allergies: 'Penicillin',
    headline: 'Lung mass RUL – work-up',
    problems: [
      { id: 'pa-1', text: 'Lung mass, right upper lobe – under investigation', since: '18.09.2026' },
      { id: 'pa-2', text: 'COPD GOLD 2', since: '2019' },
      { id: 'pa-3', text: 'Arterial hypertension', since: '2015' },
      { id: 'pa-4', text: 'Former smoker, 40 pack-years (quit 2021)', since: '2021' },
    ],
    reports: [
      {
        id: 'PATH-26-4471',
        kind: 'pathology',
        title: 'Histopathology – CT-guided core biopsy, RUL',
        date: '07.10.2026',
        author: 'Dr. A. Lindner, Pathology',
        status: 'pending',
        segments: [
          { text: 'Specimen: 3 cores, right upper lobe, CT-guided (A1–A3).' },
          { id: 'path-histo', text: 'Invasive non-mucinous adenocarcinoma, acinar-predominant pattern.' },
          { id: 'path-ihc', text: 'Immunohistochemistry: TTF-1 positive, napsin A positive, p40 negative.' },
          { id: 'path-mol', text: 'Molecular testing (EGFR, ALK, ROS1, KRAS, PD-L1) not requested on this specimen.' },
          { text: 'Sufficient tumour tissue remains in block A1 for further testing.' },
        ],
      },
      {
        id: 'MRI-26-0926',
        kind: 'imaging',
        title: 'MRI brain with contrast',
        date: '26.09.2026',
        author: 'Dr. K. Vogt, Radiology',
        status: 'final',
        segments: [
          { text: 'Indication: staging, suspected lung cancer.' },
          { id: 'mri-m', text: 'No intracranial metastases. No acute abnormality.' },
        ],
      },
      {
        id: 'PET-26-0925',
        kind: 'imaging',
        title: 'FDG PET-CT, skull base to mid-thigh',
        date: '25.09.2026',
        author: 'Dr. S. Brandl, Nuclear Medicine',
        status: 'final',
        segments: [
          { id: 'pet-primary', text: 'Intense FDG uptake in the right upper lobe mass (SUVmax 11.4).' },
          { id: 'pet-node', text: 'FDG-avid right hilar node, station 10R (SUVmax 6.2), compatible with nodal involvement.' },
          { id: 'pet-4r', text: 'Mild uptake in station 4R (SUVmax 2.6), indeterminate.' },
          { id: 'pet-m', text: 'No FDG-avid distant metastases.' },
        ],
      },
      {
        id: 'CT-26-0918',
        kind: 'imaging',
        title: 'CT thorax / upper abdomen with contrast',
        date: '18.09.2026',
        author: 'Dr. K. Vogt, Radiology',
        status: 'final',
        segments: [
          { text: 'Clinical question: weight loss, persistent cough. Former smoker.' },
          { id: 'ct-size', text: 'Spiculated mass in the right upper lobe measuring 3.6 × 2.9 cm.' },
          { id: 'ct-pleura', text: 'The lesion abuts but does not invade the visceral pleura; no chest-wall involvement.' },
          { id: 'ct-node', text: 'Enlarged right hilar lymph node (station 10R), short axis 14 mm.' },
          { id: 'ct-4r', text: 'Right lower paratracheal node (station 4R), short axis 9 mm – not enlarged by size criteria.' },
          { id: 'ct-m', text: 'No pleural effusion. Liver and adrenal glands unremarkable. No osseous lesions.' },
        ],
      },
    ],
    labs: [
      { id: 'la-1', label: 'Haemoglobin', value: '12.9', unit: 'g/dL', date: '06.10.2026', ref: '12.0–15.5' },
      { id: 'la-2', label: 'Leukocytes', value: '8.1', unit: '/nL', date: '06.10.2026', ref: '3.9–10.2' },
      { id: 'la-3', label: 'Creatinine', value: '0.8', unit: 'mg/dL', date: '06.10.2026', ref: '0.5–1.0' },
      { id: 'la-4', label: 'eGFR (CKD-EPI)', value: '79', unit: 'mL/min/1.73m²', date: '06.10.2026', ref: '>60' },
      { id: 'la-5', label: 'LDH', value: '262', unit: 'U/L', date: '06.10.2026', ref: '<247', flag: 'H' },
      { id: 'la-6', label: 'CEA', value: '7.4', unit: 'ng/mL', date: '06.10.2026', ref: '<5.0', flag: 'H' },
    ],
    meds: [
      { id: 'ma-1', drug: 'Tiotropium', dose: '18 µg', route: 'inhaled', schedule: '1× daily', status: 'active' },
      { id: 'ma-2', drug: 'Amlodipine', dose: '5 mg', route: 'oral', schedule: '1× daily', status: 'active' },
    ],
    notes: [
      {
        id: 'na-1',
        date: '19.09.2026',
        author: 'Dr. F. Huber, Pulmonology',
        title: 'Outpatient note – Pulmonology',
        text: 'Referred with 3 months of cough and 5 kg weight loss. CT shows a spiculated RUL mass with hilar adenopathy. Plan: PET-CT, brain MRI, CT-guided biopsy. Discuss at thoracic tumour board once histology is available. ECOG 1.',
      },
    ],
  },
  [PATIENT_B]: {
    id: PATIENT_B,
    mrn: '00517764',
    name: 'Thomas Keller',
    sex: 'M',
    born: '02.11.1967',
    age: 58,
    weightKg: 74,
    ward: 'Head & Neck Oncology',
    allergies: 'NKDA',
    headline: 'Oropharyngeal SCC – planned chemoradiation',
    problems: [
      { id: 'pb-1', text: 'Oropharyngeal squamous cell carcinoma, p16+ (cT2 cN1 cM0)', since: '09.09.2026' },
      { id: 'pb-2', text: 'Type 2 diabetes mellitus', since: '2014' },
      { id: 'pb-3', text: 'Chronic kidney disease G3b', since: '30.09.2026' },
    ],
    reports: [
      {
        id: 'PATH-26-3982',
        kind: 'pathology',
        title: 'Histopathology – biopsy left tonsil',
        date: '04.09.2026',
        author: 'Dr. A. Lindner, Pathology',
        status: 'final',
        segments: [
          { text: 'Invasive squamous cell carcinoma, non-keratinising.' },
          { text: 'p16 immunohistochemistry: strong, diffuse positive.' },
        ],
      },
    ],
    labs: [
      { id: 'lb-1', label: 'Creatinine', value: '1.71', unit: 'mg/dL', date: '06.10.2026', ref: '0.7–1.2', flag: 'H' },
      { id: 'lb-2', label: 'eGFR (CKD-EPI)', value: '41', unit: 'mL/min/1.73m²', date: '06.10.2026', ref: '>60', flag: 'L' },
      { id: 'lb-3', label: 'eGFR (CKD-EPI)', value: '53', unit: 'mL/min/1.73m²', date: '15.09.2026', ref: '>60', flag: 'L' },
      { id: 'lb-4', label: 'eGFR (CKD-EPI)', value: '64', unit: 'mL/min/1.73m²', date: '25.08.2026', ref: '>60' },
      { id: 'lb-5', label: 'HbA1c', value: '7.6', unit: '%', date: '15.09.2026', ref: '<6.5', flag: 'H' },
      { id: 'lb-6', label: 'Magnesium', value: '0.71', unit: 'mmol/L', date: '06.10.2026', ref: '0.66–1.07' },
    ],
    meds: [
      { id: 'mb-1', drug: 'Metformin', dose: '1000 mg', route: 'oral', schedule: '2× daily', status: 'active' },
      { id: 'mb-2', drug: 'Ramipril', dose: '5 mg', route: 'oral', schedule: '1× daily', status: 'active' },
    ],
    notes: [
      {
        id: 'nb-1',
        date: '12.09.2026',
        author: 'Dr. J. Roth, Radiation Oncology',
        title: 'Tumour board – Head & Neck',
        text: 'p16+ OPSCC left tonsil, cT2 cN1 cM0. Recommendation: definitive chemoradiation, 70 Gy / 35 fx with concurrent cisplatin. Baseline audiometry and dental review before start.',
      },
    ],
  },
});

/** Clinic worklist. Only P-A and P-B open a chart; the others make the day look real. */
export const worklist = [
  { time: '08:30', id: 'X-114', name: 'Klaus Hoffmann', dx: 'NSCLC stage IV – follow-up', status: 'Seen' },
  { time: '09:00', id: PATIENT_A, name: 'Elisabeth Brandt', dx: 'Lung mass RUL – results discussion', status: 'Waiting' },
  { time: '09:30', id: PATIENT_B, name: 'Thomas Keller', dx: 'OPSCC p16+ – chemoradiation start', status: 'Scheduled' },
  { time: '10:15', id: 'X-207', name: 'Sabine Kraus', dx: 'Ovarian ca. FIGO IIIC – consent', status: 'Scheduled' },
  { time: '11:00', id: 'X-331', name: 'Mehmet Yilmaz', dx: 'Gastric ca. cT3N1 – new referral', status: 'Scheduled' },
  { time: '13:00', id: 'X-402', name: 'Ingrid Maier', dx: 'CLL Binet B – telephone', status: 'Scheduled' },
];

export const CLINICIAN = 'Dr. M. Weber';

/** Cockcroft-Gault creatinine clearance (mL/min). */
export function cockcroftGault(age: number, weightKg: number, creatMgDl: number, female: boolean) {
  const v = ((140 - age) * weightKg) / (72 * creatMgDl);
  return Math.round(female ? v * 0.85 : v);
}
