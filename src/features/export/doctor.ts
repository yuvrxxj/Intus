// The report to take to a doctor: the latest result for each marker, read against its range, with the one before it,
// and the supplements taken. Pure, so it can be tested. It lists numbers and the ranges they were read against, and
// draws no conclusions: that is the doctor's job.
import type { Medication } from '../../db/medications.ts';
import type { MarkerRow } from '../bloodwork/model.ts';
import { formatDay, formatRange, formatValue, RANGE_LABEL } from '../bloodwork/format.ts';
import { CRITICAL } from '../../lib/safety.ts';
import { normalizeSex } from '../../lib/sex.ts';

export interface DoctorRow {
  group: string;
  marker: string;
  latest: string;
  date: string;
  range: string;
  rangeFrom: string;
  status: string;
  previous: string;
}

export interface DoctorReport {
  title: string;
  person: string;
  generated: string;
  rows: DoctorRow[];
  outside: number;
  supplements: { name: string; detail: string; dates: string }[];
}

const RANGE_FROM: Record<string, string> = { printed: 'report', default: 'usual', none: '' };

export function doctorReport(input: {
  groups: readonly { category: string; rows: readonly MarkerRow[] }[];
  supplements: readonly Pick<Medication, 'name' | 'dosage' | 'frequency' | 'start_date' | 'end_date'>[];
  name: string | null;
  age: number | null;
  sex: string | null;
  today: string;
}): DoctorReport {
  const rows: DoctorRow[] = [];
  for (const group of input.groups) {
    for (const row of group.rows) {
      const unit = row.biomarker.unit;
      const crit = row.critical.status === CRITICAL.LOW ? 'Critical low, ' : row.critical.status === CRITICAL.HIGH ? 'Critical high, ' : '';
      rows.push({
        group: group.category,
        marker: row.biomarker.name,
        latest: `${formatValue(row.latest.value)} ${unit}`,
        date: formatDay(row.latest.measured_at),
        range: row.rangeUsed.source === 'none' ? 'none' : `${formatRange(row.refLow, row.refHigh)} ${unit}`,
        rangeFrom: RANGE_FROM[row.rangeUsed.source],
        status: `${crit}${RANGE_LABEL[row.range].toLowerCase()}`.replace(/^./, (c) => c.toUpperCase()),
        previous: row.previous ? `${formatValue(row.previous.value)} on ${formatDay(row.previous.measured_at)}` : '',
      });
    }
  }
  const who = [input.name?.trim() || null, input.age != null ? `${input.age} years` : null, normalizeSex(input.sex) === 'male' ? 'Male' : normalizeSex(input.sex) === 'female' ? 'Female' : null].filter(Boolean).join(', ');
  return {
    title: 'Blood results summary',
    person: who,
    generated: formatDay(input.today),
    rows,
    outside: rows.filter((r) => /^(Critical|Below|Above)/.test(r.status)).length,
    supplements: input.supplements.map((s) => ({
      name: s.name,
      detail: [s.dosage, s.frequency].filter((x) => x && String(x).trim() !== '').join(', '),
      dates: s.start_date ? `${formatDay(s.start_date)}${s.end_date ? ` to ${formatDay(s.end_date)}` : ' onwards'}` : 'dates not recorded',
    })),
  };
}
