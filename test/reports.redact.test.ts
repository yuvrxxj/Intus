import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_LINE, redactReport } from '../src/features/reports/redact.ts';

// The shapes a real report prints at the top of every page. The people, numbers and addresses are invented.
const HEADER = [
  'Patient Name   : Mr Asha Verma   Barcode   : K1234567',
  'Age/Gender   : 41Y 0M 0D /Female   Sample Collected On   : 02/Mar/2026 07:11AM',
  'Order Id   : 98765432101   Sample Received On   : 02/Mar/2026 12:45PM',
  'Customer Since   : 10/Apr/2022   Report Generated On   : 02/Mar/2026 02:07PM',
  'Mr Asha Verma Booking ID : 98765432101 | Sample Collection Date : 02/Mar/2026',
  'Female, 41 Yrs',
  'Dr. Rakesh Gupta',
  'MBBS, MD Biochemistry',
  'Consultant Biochemist',
  'DMC - 12345, ACME Labs',
  'ACME Labs, Plot 4, Sector 9, Pincode-110011',
  'Contact: asha.verma@example.com +91 98765 43210 https://acme.test/report/12',
  'Hello Asha, your results are ready, call 98765-43210 or 09876543210',
];
const RESULTS = [
  'Haemoglobin (HB) 16.0 g/dL 13.0-17.0',
  'Testosterone, Total 411.50 ng/dl 197.44-669.58',
  'Sex hormone binding globulin 45 nmol/L 20 - 60',
  'Platelet Count 244 10^3/μl 150-410',
  'Glycated Hemoglobin (HbA1c) 4.6 % 4.2 - 5.7',
  'Thyroid Stimulating Hormone 1.985 μIU/ml 0.55 - 4.78',
];

test('identity is removed from the lines that carry it and from the lines that only mention it', () => {
  const r = redactReport([...HEADER, ...RESULTS], { names: ['Asha Verma'], sampleDate: '2026-03-02' });
  const text = r.lines.join('\n');
  for (const secret of ['Asha', 'Verma', 'K1234567', '98765432101', '9876543210', '98765 43210', '98765-43210', 'example.com', 'acme.test', 'Gupta', 'MBBS', '110011', 'Female', '41Y']) {
    assert.ok(!text.includes(secret), `${secret} leaked`);
  }
  assert.ok(r.removedLines >= 9);
  assert.ok(r.masked >= 4);
});

test('results come through untouched, including ranges and the test whose name starts like a label', () => {
  const r = redactReport([...HEADER, ...RESULTS], { names: ['Asha Verma'] });
  for (const line of RESULTS) assert.ok(r.lines.includes(line), line);
});

test('the sample date is put back as its own first line, since the lines that carried it were removed', () => {
  assert.equal(redactReport(HEADER, { sampleDate: '2026-03-02' }).lines[0], 'Sample date: 2026-03-02');
  assert.ok(!redactReport(HEADER).lines.some((l) => l.startsWith('Sample date')));
});

test('paragraphs and repeated page headers are left out, so only results and their names are sent', () => {
  const paragraph = 'Increased levels are consistent with an acute inflammatory process and may be seen after surgery or injury.';
  assert.ok(paragraph.length < MAX_LINE);
  const long = `${'Diseases resulting in elevation include '.repeat(8)}1`;
  assert.ok(long.length > MAX_LINE);
  const r = redactReport(['Test Name Value Unit', 'Test Name Value Unit', paragraph, long, 'HbA1c - Glycosylated Hemoglobin', ...RESULTS]);
  assert.deepEqual(r.lines, ['Test Name Value Unit', 'HbA1c - Glycosylated Hemoglobin', ...RESULTS]);
});

test('numbers that look a little like phone numbers or IDs, in ranges and counts, are left alone', () => {
  const keep = ['Testosterone, Total 411.50 ng/dl 197.44-669.58 12.3 - 46.6', 'Platelet Count 244 10^3/μl 150-410', 'Total Cholesterol 138.0 mg/dl Desirable : <200', 'Mean Corp Volume (MCV) 97.0 fL 83.0-101.0'];
  assert.deepEqual(redactReport(keep).lines, keep);
});

test('only whole words of the person\'s own name are masked, and short or odd words are ignored', () => {
  const r = redactReport(['Prepared for Asha Verma-Singh', 'Ashanti 5.0 mg/dl', 'Report 12'], { names: ['Asha', 'Al', '', 'x-y'] });
  assert.deepEqual(r.lines, ['Prepared for [name] Verma-Singh', 'Ashanti 5.0 mg/dl', 'Report 12']);
});
