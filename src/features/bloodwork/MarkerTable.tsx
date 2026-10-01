import { Fragment } from 'react';
import { CRITICAL, checkCritical } from '../../lib/safety.ts';
import { TREND } from '../../lib/trends.ts';
import { rangeStatus, type Change, type MarkerRow, type Point, type RangeStatus } from './model.ts';
import {
  ARROW, DIRECTION_WORD, RANGE_LABEL, describeDays, formatDay, formatDelta, formatRange, formatValue,
} from './format.ts';
import { Sparkline } from './Sparkline.tsx';

const VALUE_CLASS: Record<RangeStatus, string> = {
  in_range: 'bv-ok',
  below: 'bv-lo',
  above: 'bv-hi',
  no_range: 'bv-none',
};
const PILL_CLASS: Record<RangeStatus, string> = {
  in_range: 'bk bk-ok',
  below: 'bk bk-lo',
  above: 'bk bk-hi',
  no_range: 'bk bk-none',
};

function isDemo(point: Point): boolean {
  return point.source === 'seed_demo';
}

function changeLabel(change: Change): string {
  const pct = change.percent === null ? '' : `, ${change.percent > 0 ? '+' : change.percent < 0 ? '-' : ''}${Math.abs(change.percent).toFixed(1)}%`;
  const amount = change.direction === 'flat' ? '' : ` ${formatDelta(change.delta)}`;
  return `${DIRECTION_WORD[change.direction]}${amount}${pct} since ${formatDay(change.from.measured_at)}, ${describeDays(change.days)}`;
}

/**
 * The arrow compares the latest result with the one before it. It is deliberately not coloured good or bad:
 * whether up is better depends on the marker, and this app does not make that call. A statistical trend
 * (Mann-Kendall) is only reported once there are five results.
 */
function ChangeCell({ row }: { row: MarkerRow }) {
  const { change, trend } = row;
  if (!change) return <span className="chg-none">First result</span>;
  const pct = change.percent === null ? '' : ` (${change.percent > 0 ? '+' : change.percent < 0 ? '−' : ''}${Math.abs(change.percent).toFixed(1)}%)`;
  return (
    <div>
      <span className={`chg chg-${change.direction}`} title={changeLabel(change)} aria-label={changeLabel(change)}>
        <span className="chg-arrow" aria-hidden="true">{ARROW[change.direction]}</span>{' '}
        {change.direction === 'flat' ? 'No change' : `${formatDelta(change.delta)}${pct}`}
      </span>
      <div className="chg-sub">vs {formatDay(change.from.measured_at)}</div>
      {trend.direction !== TREND.INSUFFICIENT_DATA && (
        <div className="chg-trend">
          Trend: {trend.direction === TREND.NO_TREND ? 'none detected' : trend.direction} ({trend.n} results)
        </div>
      )}
    </div>
  );
}

function StatusCell({ row }: { row: MarkerRow }) {
  const critical = row.critical.status;
  return (
    <div className="status-stack">
      {(critical === CRITICAL.LOW || critical === CRITICAL.HIGH) && (
        <span className="bk bk-crit">{critical === CRITICAL.LOW ? 'Critical low' : 'Critical high'}</span>
      )}
      <span className={PILL_CLASS[row.range]}>{RANGE_LABEL[row.range]}</span>
    </div>
  );
}

function Detail({ row }: { row: MarkerRow }) {
  const { biomarker, points } = row;
  const newestFirst = [...points].reverse();
  const biotinFor = (id: string) => row.biotin.filter((w) => w.reading_id === id);
  const noLimit = biomarker.critical_low == null && biomarker.critical_high == null;
  const limits = [
    biomarker.critical_low != null ? `low ${formatValue(Number(biomarker.critical_low))}` : null,
    biomarker.critical_high != null ? `high ${formatValue(Number(biomarker.critical_high))}` : null,
  ].filter(Boolean);

  return (
    <div className="bt-detail-grid">
      <div>
        <Sparkline points={points} refLow={row.refLow} refHigh={row.refHigh} />
        <div className="bt-limits">
          <div>Reference range: {formatRange(row.refLow, row.refHigh)} {biomarker.unit}</div>
          {noLimit ? (
            <div className="bt-nolimit">No critical limit is set for this marker, so it can never be flagged as critical.</div>
          ) : (
            <div>
              Critical limits: {limits.join(', ')} {biomarker.unit}
              {biomarker.threshold_source ? <span className="ci-src"> Source: {biomarker.threshold_source}</span> : null}
            </div>
          )}
          {biomarker.description ? <div className="bt-desc">{biomarker.description}</div> : null}
        </div>
      </div>
      <div className="bt-wrap">
      <table className="bt bt-hist">
        <thead>
          <tr><th>Date</th><th>Result</th><th>Status</th><th>Notes</th></tr>
        </thead>
        <tbody>
          {newestFirst.map((p) => {
            const range = rangeStatus(biomarker, p.value);
            const crit = checkCritical(biomarker, p.value).status;
            const biotin = biotinFor(p.id);
            return (
              <tr key={p.id}>
                <td>{formatDay(p.measured_at)}</td>
                <td className={VALUE_CLASS[range]}>{formatValue(p.value)}</td>
                <td>
                  {crit === CRITICAL.LOW || crit === CRITICAL.HIGH ? <span className="bk bk-crit">{crit === CRITICAL.LOW ? 'Critical low' : 'Critical high'}</span> : null}{' '}
                  <span className={PILL_CLASS[range]}>{RANGE_LABEL[range]}</span>
                </td>
                <td>
                  <div className="bt-notes">
                  {isDemo(p) ? <span className="tag tag-demo" title="This row was loaded as demo data, not from a lab report.">demo data</span> : null}
                  {biotin.map((w) => (
                    <span key={w.medication} className="tag tag-warn" title={`Taken while on ${w.medication}${w.dosage ? ` (${w.dosage})` : ''}. Biotin can distort some lab assays.`}>
                      biotin: {w.medication}
                    </span>
                  ))}
                  {p.notes ? <span>{p.notes}</span> : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

interface Props {
  rows: readonly MarkerRow[];
  expanded: ReadonlySet<string>;
  onToggle: (biomarkerId: string) => void;
}

export function MarkerTable({ rows, expanded, onToggle }: Props) {
  return (
    <div className="bt-wrap">
      <table className="bt bt-main">
        <colgroup>
          <col style={{ width: '27%' }} />
          <col style={{ width: '17%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '20%' }} />
          <col style={{ width: '22%' }} />
        </colgroup>
        <thead>
          <tr><th>Marker</th><th>Latest</th><th>Range</th><th>Status</th><th>Change</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const open = expanded.has(row.biomarker.id);
            const latestBiotin = row.biotin.some((w) => w.reading_id === row.latest.id);
            return (
              <Fragment key={row.biomarker.id}>
                <tr className={`bt-row${open ? ' bt-open' : ''}`}>
                  <td>
                    <button
                      type="button"
                      className="bt-name"
                      aria-expanded={open}
                      aria-controls={`detail-${row.biomarker.id}`}
                      onClick={() => onToggle(row.biomarker.id)}
                    >
                      <span className="bt-caret" aria-hidden="true">{open ? '▾' : '▸'}</span>
                      {row.biomarker.name}
                    </button>
                    {isDemo(row.latest) ? <span className="tag tag-demo" title="The latest result is demo data.">demo data</span> : null}
                    {latestBiotin ? <span className="tag tag-warn" title="The latest result was taken while on biotin, which can distort some lab assays.">biotin</span> : null}
                  </td>
                  <td data-label="Latest">
                    <span className={VALUE_CLASS[row.range]}>{formatValue(row.latest.value)}</span>{' '}
                    <span className="bt-unit">{row.biomarker.unit}</span>
                  </td>
                  <td data-label="Range">{formatRange(row.refLow, row.refHigh)}</td>
                  <td data-label="Status"><StatusCell row={row} /></td>
                  <td data-label="Change"><ChangeCell row={row} /></td>
                </tr>
                {open && (
                  <tr className="bt-detail" id={`detail-${row.biomarker.id}`}>
                    <td colSpan={5}><Detail row={row} /></td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
