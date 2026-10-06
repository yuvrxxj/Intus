import { useMemo } from 'react';
import type { Medication as Supplement } from '../../db/medications.ts';
import { RANGE_LABEL, formatDay } from '../bloodwork/format.ts';
import type { RangeStatus } from '../bloodwork/model.ts';
import { dayNumber } from '../../lib/dates.ts';
import { BEFORE_DAYS, MIN_DAYS, type BloodPair, type MetricEffect, type Verdict } from './effect.ts';
import { sortSupplements } from './model.ts';
import { useSupplementEffects, type EffectsState, type SupplementEffect } from './useSupplementEffects.ts';

const PILL: Record<RangeStatus, string> = { in_range: 'bk bk-ok', below: 'bk bk-lo', above: 'bk bk-hi', no_range: 'bk bk-none' };

/** Four significant figures, no float noise: 69.97857 becomes 69.98 and 9012.3 becomes 9012. */
function fmt(value: number): string {
  return String(Number(value.toPrecision(4)));
}

function signed(value: number): string {
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${fmt(Math.abs(value))}`;
}

function percentOf(percent: number | null): string {
  return percent === null ? '' : ` (${percent > 0 ? '+' : percent < 0 ? '−' : ''}${Math.abs(percent).toFixed(1)}%)`;
}

const VERDICT_WORD: Record<Exclude<Verdict, 'insufficient_data'>, string> = {
  higher: 'Higher',
  lower: 'Lower',
  no_clear_change: 'No clear change',
};

function daysOf(n: number): string {
  return `${n} day${n === 1 ? '' : 's'}`;
}

function unitOf(m: { unit: string }): string {
  return m.unit ? ` ${m.unit}` : '';
}

function MetricRow({ m }: { m: MetricEffect }) {
  const enough = m.verdict !== 'insufficient_data';
  return (
    <tr>
      <td>{m.label}</td>
      <td data-label="Before">{m.before.mean === null ? '—' : <>{fmt(m.before.mean)}{unitOf(m)} <span className="fx-n">{daysOf(m.before.n)}</span></>}</td>
      <td data-label="After">{m.after.mean === null ? '—' : <>{fmt(m.after.mean)}{unitOf(m)} <span className="fx-n">{daysOf(m.after.n)}</span></>}</td>
      <td data-label="Change">{enough && m.diff !== null ? (m.diff === 0 ? 'No change' : `${signed(m.diff)}${percentOf(m.percent)}`) : '—'}</td>
      <td data-label="Reading">
        {enough ? (
          <span className={`fx-verdict fx-${m.verdict}`}>{VERDICT_WORD[m.verdict as Exclude<Verdict, 'insufficient_data'>]}</span>
        ) : (
          <span className="fx-wait">Needs {MIN_DAYS} logged days in each period ({m.before.n} before, {m.after.n} after)</span>
        )}
      </td>
    </tr>
  );
}

function BloodRow({ p }: { p: BloodPair }) {
  const u = p.biomarker.unit;
  return (
    <tr>
      <td>{p.biomarker.name}</td>
      <td data-label="Before">
        {fmt(p.before.value)} {u} <span className="fx-n">{formatDay(p.before.measured_at)}</span>
        <div><span className={PILL[p.before.range]}>{RANGE_LABEL[p.before.range]}</span></div>
      </td>
      <td data-label="After">
        {fmt(p.after.value)} {u} <span className="fx-n">{formatDay(p.after.measured_at)}</span>
        <div><span className={PILL[p.after.range]}>{RANGE_LABEL[p.after.range]}</span></div>
      </td>
      <td data-label="Change">{p.delta === 0 ? 'No change' : `${signed(p.delta)} ${u}${percentOf(p.percent)}`}</td>
      <td data-label="On it for">{daysOf(p.daysOn)}</td>
    </tr>
  );
}

/** One line for the closed row: what is there to see, without claiming more than the numbers do. */
function headline({ report }: SupplementEffect): string {
  if (report.status === 'not_started') return 'Starts later, nothing to compare yet';
  const clear = report.metrics.filter((m) => m.verdict === 'higher' || m.verdict === 'lower').length;
  const ready = report.metrics.filter((m) => m.verdict !== 'insufficient_data').length;
  const bits: string[] = [];
  if (ready === 0) bits.push('Not enough logged days yet');
  else if (clear === 0) bits.push('No clear change in anything you log');
  else bits.push(`${clear} thing${clear === 1 ? '' : 's'} moved`);
  if (report.blood.length > 0) bits.push(`${report.blood.length} blood marker${report.blood.length === 1 ? '' : 's'} with a result each side`);
  if (report.overlaps.length > 0) bits.push('overlaps with other changes, read with care');
  return bits.join(' · ');
}

function Detail({ effect, today }: { effect: SupplementEffect; today: string }) {
  const { item, report } = effect;
  const waiting = report.earliestVerdict !== null && dayNumber(report.earliestVerdict) > dayNumber(today);
  return (
    <div className="fx-body">
      {report.overlaps.length > 0 && (
        <div className="notice notice-warn" role="note">
          {report.overlaps.join(', ')} {report.overlaps.length === 1 ? 'was' : 'were'} started or stopped close to the same time, so what changed cannot be put down to {item.name} alone.
        </div>
      )}

      {report.status === 'not_started' ? (
        <div className="empty">{item.name} starts on {formatDay(item.start_date as string)}. The first comparison can be made around {formatDay(report.earliestVerdict as string)}, once there are {MIN_DAYS} days of logs after the first week.</div>
      ) : (
        <>
          {report.metrics.length === 0 ? (
            <div className="empty">
              Nothing logged in the {BEFORE_DAYS} days before the start or in the weeks after it, so there is nothing to compare yet.
              {waiting ? ` The first comparison could be made around ${formatDay(report.earliestVerdict as string)}.` : ''}
            </div>
          ) : (
            <div className="bt-wrap">
              <table className="bt fx-table">
                <thead><tr><th>What you log</th><th>Before</th><th>After</th><th>Change</th><th>Reading</th></tr></thead>
                <tbody>{report.metrics.map((m) => <MetricRow key={m.id} m={m} />)}</tbody>
              </table>
            </div>
          )}

          {report.blood.length > 0 && (
            <>
              <div className="bio-sec">Bloodwork</div>
              <div className="bt-wrap">
                <table className="bt fx-table">
                  <thead><tr><th>Marker</th><th>Last result before</th><th>Latest result on it</th><th>Change</th><th>On it for</th></tr></thead>
                  <tbody>{report.blood.map((p) => <BloodRow key={p.biomarker.id} p={p} />)}</tbody>
                </table>
              </div>
              <div className="fld-hint">Two results, not a trend. Day-to-day and lab-to-lab variation alone moves many markers by several percent.</div>
            </>
          )}
        </>
      )}
    </div>
  );
}

/**
 * What happened alongside each supplement. It sets two periods side by side and never says the supplement did
 * anything: no change is coloured good or bad, a verdict needs enough logged days, and the limits of this kind of
 * comparison are on the screen the whole time, not behind a click.
 */
export function SupplementEffects({ items, today }: { items: readonly Supplement[]; today: string }) {
  const state = useSupplementEffects(items, today);
  return <SupplementEffectsView items={items} today={today} state={state} />;
}

/** The screen itself, given its data, so it can be drawn with made-up data and checked by eye. */
export function SupplementEffectsView({ items, today, state }: {
  items: readonly Supplement[];
  today: string;
  state: EffectsState & { reload: () => void };
}) {
  const withStart = useMemo(() => sortSupplements(items.filter((i) => i.start_date != null), today), [items, today]);

  return (
    <div className="card sec" data-testid="supplement-effects">
      <div className="ct"><span className="dot dot-blue" />What changed since you started</div>
      <div className="fx-intro">
        Sets the {BEFORE_DAYS} days before you started each supplement against the days from the second week on. Only days you logged count, and nothing is compared until each period has {MIN_DAYS} of them.
      </div>

      {withStart.length === 0 ? (
        <div className="empty">Add a start date to a supplement and, as you log, this compares how you were doing before and after.</div>
      ) : state.status === 'loading' ? (
        <div className="loading">Loading your logs</div>
      ) : state.status === 'error' ? (
        <div className="cbanner" role="alert">
          <div className="cbanner-hdr">The comparison could not be loaded</div>
          <div className="ci">{state.message}</div>
          <button type="button" className="retry-btn" onClick={state.reload}>Try again</button>
        </div>
      ) : state.status === 'ready' ? (
        <div className="fx-list">
          {withStart.map((item) => {
            const effect = state.effects.find((e) => e.item.id === item.id);
            if (!effect) return null;
            return (
              <details key={item.id} className="fx-item">
                <summary>
                  <span className="fx-name">{item.name}</span>
                  <span className="fx-sub">Started {formatDay(item.start_date as string)}{item.end_date ? `, stopped ${formatDay(item.end_date)}` : ''} · {headline(effect)}</span>
                </summary>
                <Detail effect={effect} today={today} />
              </details>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

