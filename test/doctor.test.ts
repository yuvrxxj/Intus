import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBloodworkView } from '../src/features/bloodwork/model.ts';
import { doctorReport } from '../src/features/export/doctor.ts';
import type { Biomarker, BiomarkerReading } from '../src/db/queries.ts';

// Invented rows.
const marker = (id: string, name: string, over: Partial<Biomarker> = {}): Biomarker => ({
  id, code: id, name, unit: 'u', category: 'Group', organ_systems: [], ref_low: null, ref_high: null, optimal_low: null, optimal_high: null,
  description: null, sort_order: 0, created_at: '2026-01-01T00:00:00Z', critical_low: null, critical_high: null, threshold_source: null, ref_sex: null, ...over,
});
const reading = (id: string, biomarker_id: string, measured_at: string, value: number, over: Partial<BiomarkerReading> = {}): BiomarkerReading => ({
  id, biomarker_id, measured_at, value, notes: null, created_at: '2026-01-01T00:00:00Z', status: null, source: 'manual', user_id: 'u', ref_low: null, ref_high: null, ...over,
});

test('the doctor report lists each latest result against its range, the one before, and the supplements', () => {
  const view = buildBloodworkView({
    sex: 'female',
    biomarkers: [marker('hb', 'Hemoglobin', { ref_low: 13.5, ref_high: 17.5, ref_sex: 'male', unit: 'g/dL' }), marker('k', 'Potassium', { ref_low: 3.5, ref_high: 5.1, critical_high: 6.5, unit: 'mmol/L' })],
    readings: [
      reading('1', 'hb', '2026-04-01', 12.4),
      reading('2', 'hb', '2026-10-06', 11.2, { ref_low: 12, ref_high: 15.5 }),
      reading('3', 'k', '2026-10-06', 6.8),
    ],
  });
  const report = doctorReport({
    groups: view.groups,
    supplements: [{ name: 'Creatine', dosage: '5 g', frequency: 'daily', start_date: '2026-08-01', end_date: null }, { name: 'Iron', dosage: null, frequency: null, start_date: null, end_date: null }],
    name: 'Sam', age: 34, sex: 'F', today: '2026-10-12',
  });
  assert.equal(report.person, 'Sam, 34 years, Female');
  assert.equal(report.generated, '12 Oct 2026');
  assert.deepEqual(report.rows.map((r) => [r.marker, r.latest, r.range, r.rangeFrom, r.status, r.previous]), [
    ['Hemoglobin', '11.2 g/dL', '12–15.5 g/dL', 'report', 'Below range', '12.4 on 1 Apr 2026'],
    ['Potassium', '6.8 mmol/L', '3.5–5.1 mmol/L', 'usual', 'Critical high, above range', ''],
  ]);
  assert.equal(report.outside, 2);
  assert.deepEqual(report.supplements, [
    { name: 'Creatine', detail: '5 g, daily', dates: '1 Aug 2026 onwards' },
    { name: 'Iron', detail: '', dates: 'dates not recorded' },
  ]);
});
