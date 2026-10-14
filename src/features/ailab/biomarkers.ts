// A copy of the `biomarkers` reference table (ranges, critical limits, categories), read from the live project on 14 Oct
// 2026 with a read-only select, so the AI lab can draw the Bloodwork screen without a database. It holds no personal
// data: it is the same table every signed-in account reads. Regenerate it the same way if the table changes.
import type { Biomarker } from '../../db/queries.ts';

const U = 'Unverified estimate - needs clinician review';
const C = 'Common lab critical value, unit-converted - unverified, needs clinician review';
const P = 'Published guideline range (ESC 2021 / ADA 2023 / Endocrine Society), unit-converted';

type N = number | null;
type Row = [id: string, code: string, name: string, unit: string, category: string, organs: string[], refLow: N, refHigh: N, optLow: N, optHigh: N, sort: number, critLow: N, critHigh: N, source: string | null, sex: 'male' | 'female' | null];

const ROWS: Row[] = [
  ['cd48e7d1-5175-47bf-90da-68a22c2b8991', 'alt', 'ALT', 'U/L', 'hepatic', ['liver'], 7, 56, 10, 25, 1, null, 200, U, null],
  ['941968b4-d480-4b11-aed7-1503f37761db', 'ast', 'AST', 'U/L', 'hepatic', ['liver'], 10, 40, 10, 25, 2, null, 200, U, null],
  ['179fbfaa-8c39-4ec2-9856-913c9b0133e1', 'creatinine', 'Creatinine', 'mg/dL', 'renal', ['kidney'], 0.7, 1.3, 0.8, 1.1, 3, null, 4, U, 'male'],
  ['89d6bec6-5e98-4296-89c0-5801c93e2ef2', 'egfr', 'eGFR', 'mL/min', 'renal', ['kidney'], 90, 120, 95, 120, 4, 15, null, U, null],
  ['c97442b6-2919-4366-a2f4-39e36aba3128', 'hemoglobin', 'Hemoglobin', 'g/dL', 'hematologic', ['heart', 'circulatory'], 13.5, 17.5, 14, 16, 5, 7, null, C, 'male'],
  ['b66c427c-1a6d-4488-bf6c-29497d7372c0', 'ferritin', 'Ferritin', 'ng/mL', 'hematologic', ['heart', 'circulatory'], 30, 400, 60, 200, 6, null, null, null, 'male'],
  ['817fb933-d430-48b9-9133-f02b3225a543', 'tsh', 'TSH', 'mIU/L', 'thyroid', ['thyroid'], 0.4, 4, 1, 2.5, 7, 0.1, 20, U, null],
  ['d7669c72-2d22-414c-9935-56c6fa4457a0', 't3_free', 'Free T3', 'pg/mL', 'thyroid', ['thyroid'], 2.3, 4.2, 3, 4, 8, null, null, null, null],
  ['8aaf6f19-c130-4a8e-bab9-2440ba51fc23', 't4_free', 'Free T4', 'ng/dL', 'thyroid', ['thyroid'], 0.8, 1.8, 1, 1.5, 9, null, null, null, null],
  ['e812523b-b56e-4703-9830-d13c7fdbf8fc', 'testosterone', 'Testosterone', 'ng/dL', 'hormonal', ['adrenal'], 300, 1000, 600, 900, 10, null, null, null, 'male'],
  ['6671d2ef-e936-4181-b296-786332abb16b', 'cortisol', 'Cortisol', 'µg/dL', 'hormonal', ['adrenal', 'brain'], 6, 23, 10, 18, 11, null, null, null, null],
  ['713230f0-f131-468b-9230-264b00bf937d', 'glucose', 'Glucose', 'mg/dL', 'metabolic', ['pancreas'], 70, 99, 75, 90, 12, 54, 250, U, null],
  ['9ab7fb48-d83f-4c6a-8c03-71df50dcea25', 'hba1c', 'HbA1c', '%', 'metabolic', ['pancreas'], 4, 5.7, 4.8, 5.3, 13, null, 9, P, null],
  ['42a8cfd8-9bd5-4586-8d3d-5153462b0b89', 'ldl', 'LDL', 'mg/dL', 'cardiovascular', ['heart'], 0, 116, 40, 80, 14, null, 190, P, null],
  ['28e1f9d1-35b2-42d5-a98a-8eb3af9f7631', 'hdl', 'HDL', 'mg/dL', 'cardiovascular', ['heart'], 39, 100, 55, 90, 15, 20, null, P, 'male'],
  ['11762ce0-266f-45c9-b74f-6b342dced848', 'crp', 'hs-CRP', 'mg/L', 'inflammatory', ['inflammation'], 0, 3, 0, 1, 16, null, null, null, null],
  ['14f533b7-41ca-4067-a6f8-a274a8fb049e', 'vitamin_d', 'Vitamin D', 'ng/mL', 'nutritional', ['skeletal'], 30, 100, 30, 50, 17, 10, null, P, null],
  ['40360b61-168a-47ef-9a8f-e7fb5c3c72ad', 'nt_probnp', 'NT-proBNP', 'pg/mL', 'cardiovascular', ['heart'], 0, 106, 0, 50, 18, null, null, null, null],
  ['7e5f20a7-f4af-41d9-9da7-d8664a91c218', 'vitamin_b12', 'Vitamin B12', 'pg/ml', 'nutritional', ['circulatory', 'brain'], 211, 912, 400, 900, 19, null, null, null, null],
  ['b19a88c4-b243-4fd1-a2dd-7c721e5b7a5c', 'serum_iron', 'Serum Iron', 'ug/dl', 'hematologic', ['circulatory'], 65, 175, 80, 160, 20, null, null, null, 'male'],
  ['00e3b10d-2a96-4903-8ff0-88906c0e62a7', 'calcium', 'Calcium', 'mg/dl', 'nutritional', ['skeletal'], 8.7, 10.4, 9, 10.2, 21, 6.4, 14, C, null],
  ['c3cd590b-6f97-407c-8438-5a4e7e71aa04', 'transferrin_sat', 'Transferrin Saturation', '%', 'hematologic', ['circulatory'], 10, 50, 20, 40, 22, null, null, null, null],
  ['72408ffe-c329-48eb-a325-05d45b3aa3b1', 'total_cholesterol', 'Total Cholesterol', 'mg/dl', 'cardiovascular', ['heart'], 0, 200, 0, 180, 23, null, 300, U, null],
  ['4fe3a0a9-9794-4324-84e8-127ea8b7aa41', 'triglycerides', 'Triglycerides', 'mg/dL', 'cardiovascular', ['heart'], 0, 150, 0, 100, 24, null, 500, U, null],
  ['39ff8a50-daa2-4144-8b7e-7257cd3f03a8', 'blood_urea', 'Blood Urea', 'mg/dl', 'renal', ['kidney'], 19.3, 49.4, 20, 40, 25, null, null, null, null],
  ['f5bf13fa-78af-4378-b8c2-5df56a86b2eb', 'uric_acid', 'Uric Acid', 'mg/dl', 'renal', ['kidney'], 3.5, 7.2, 3.5, 6.5, 26, null, null, null, 'male'],
  ['d097b55c-3fc7-49dc-af0e-697e9abb4401', 'ggt', 'GGT', 'U/L', 'hepatic', ['liver'], 0, 55, 0, 40, 27, null, null, null, null],
  ['c1af1e1e-ed9c-4083-b894-f0f676b496d4', 'albumin', 'Albumin', 'g/dl', 'hepatic', ['liver'], 3.4, 4.8, 4, 4.8, 28, null, null, null, null],
  ['5a43090e-266f-482f-a626-ce6a8fc94b8d', 'wbc_tlc', 'WBC / TLC', '10³/µL', 'hematologic', ['circulatory', 'inflammation'], 4, 10, 4.5, 9, 29, null, null, null, null],
  ['aef8775c-c410-4adb-9e74-51767894df11', 'platelets', 'Platelets', '10³/µl', 'hematologic', ['circulatory'], 150, 410, 180, 380, 30, 30, null, C, null],
  ['9ac4a759-7545-446f-8b90-21e75f9dbe29', 't4_total', 'T4 Total', 'ug/dl', 'thyroid', ['thyroid'], 3.2, 12.6, 5, 11, 31, null, null, null, null],
  ['f7b59bc7-8b72-4db6-ac3f-f68c0d611d91', 'potassium', 'Potassium', 'mmol/L', 'electrolytes', [], 3.5, 5.1, null, null, 130, 2.8, 6, C, null],
  ['3c64c8a8-3db1-4e58-a4ad-a5b7349f8517', 'sodium', 'Sodium', 'mmol/L', 'electrolytes', [], 136, 145, null, null, 140, 120, 160, C, null],
  ['daa4f09e-8066-4c6a-9eec-0d20845eb734', 'oestradiol', 'Oestradiol', 'pg/mL', 'hormonal', ['reproductive'], null, null, null, null, 200, null, null, null, null],
  ['4400fa71-cb8d-4971-9bb6-39494cb1556f', 'progesterone', 'Progesterone', 'ng/mL', 'hormonal', ['reproductive'], null, null, null, null, 201, null, null, null, null],
  ['9d225c6d-0893-4769-b164-74d0be3c36ee', 'lh', 'LH', 'mIU/mL', 'hormonal', ['reproductive'], null, null, null, null, 202, null, null, null, null],
  ['defd94e6-1851-4b10-868f-636abd94d65a', 'fsh', 'FSH', 'mIU/mL', 'hormonal', ['reproductive'], null, null, null, null, 203, null, null, null, null],
  ['6219b6e4-4ddf-4f15-aaff-5628244c3398', 'prolactin', 'Prolactin', 'ng/mL', 'hormonal', ['reproductive'], null, null, null, null, 204, null, null, null, null],
  ['3074bc27-1529-4e9a-bbd2-c0d593f41bc6', 'shbg', 'SHBG', 'nmol/L', 'hormonal', ['reproductive'], null, null, null, null, 205, null, null, null, null],
];

export const BIOMARKERS: readonly Biomarker[] = ROWS.map(([id, code, name, unit, category, organ_systems, ref_low, ref_high, optimal_low, optimal_high, sort_order, critical_low, critical_high, threshold_source, ref_sex]) => ({
  id, code, name, unit, category, organ_systems, ref_low, ref_high, optimal_low, optimal_high, sort_order, critical_low, critical_high, threshold_source, ref_sex,
  description: null,
  created_at: '2026-01-01T00:00:00Z',
}));
