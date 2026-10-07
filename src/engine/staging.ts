import type { MCat, NCat, TCat, TNM } from './types';

export const T_OPTIONS: { v: TCat; d: string }[] = [
  { v: 'T1a', d: '≤ 1 cm' },
  { v: 'T1b', d: '> 1 – ≤ 2 cm' },
  { v: 'T1c', d: '> 2 – ≤ 3 cm' },
  { v: 'T2a', d: '> 3 – ≤ 4 cm, or pleura/bronchus' },
  { v: 'T2b', d: '> 4 – ≤ 5 cm' },
  { v: 'T3', d: '> 5 – ≤ 7 cm, or chest wall / separate nodule same lobe' },
  { v: 'T4', d: '> 7 cm, or mediastinal invasion / other ipsilateral lobe' },
];

export const N_OPTIONS: { v: NCat; d: string }[] = [
  { v: 'N0', d: 'No regional nodes' },
  { v: 'N1', d: 'Ipsilateral peribronchial / hilar' },
  { v: 'N2', d: 'Ipsilateral mediastinal / subcarinal' },
  { v: 'N3', d: 'Contralateral or supraclavicular' },
];

export const M_OPTIONS: { v: MCat; d: string }[] = [
  { v: 'M0', d: 'No distant metastasis' },
  { v: 'M1a', d: 'Pleural / contralateral lung' },
  { v: 'M1b', d: 'Single extrathoracic metastasis' },
  { v: 'M1c', d: 'Multiple extrathoracic metastases' },
];

/** Lung cancer stage grouping, AJCC/UICC 8th edition (illustrative implementation). */
export function lungStage({ T, N, M }: TNM): string {
  if (M === 'M1c') return 'IVB';
  if (M === 'M1a' || M === 'M1b') return 'IVA';
  const t3or4 = T === 'T3' || T === 'T4';
  if (N === 'N3') return t3or4 ? 'IIIC' : 'IIIB';
  if (N === 'N2') return t3or4 ? 'IIIB' : 'IIIA';
  if (N === 'N1') return t3or4 ? 'IIIA' : 'IIB';
  return { T1a: 'IA1', T1b: 'IA2', T1c: 'IA3', T2a: 'IB', T2b: 'IIA', T3: 'IIB', T4: 'IIIA' }[T];
}

export const tnmString = (x: TNM) => `c${x.T} c${x.N} c${x.M}`;
