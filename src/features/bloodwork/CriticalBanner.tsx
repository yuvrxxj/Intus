import type { CriticalFinding } from '../../lib/safety.ts';
import { CRITICAL } from '../../lib/safety.ts';
import type { Biomarker } from '../../db/queries.ts';
import { formatDay, formatValue } from './format.ts';

interface Props {
  current: readonly CriticalFinding[];
  past: readonly CriticalFinding[];
  biomarkers: readonly Biomarker[];
  unwatched: readonly string[];
}

function limitCrossed(f: CriticalFinding): string {
  return f.status === CRITICAL.LOW
    ? `at or below the critical low limit of ${formatValue(f.critical_low ?? NaN)}`
    : `at or above the critical high limit of ${formatValue(f.critical_high ?? NaN)}`;
}

function FindingLine({ f, source }: { f: CriticalFinding; source: string | null }) {
  return (
    <div className="ci">
      <span>
        <strong>{f.name ?? f.code}</strong> {formatValue(f.value)} {f.unit} on {formatDay(f.measured_at)}, {limitCrossed(f)}.
        {source ? <span className="ci-src"> Limit source: {source}</span> : null}
      </span>
    </div>
  );
}

/**
 * The first thing on the screen. It says what crossed a stored critical limit and, just as plainly, what cannot
 * be checked: a marker with no limit is never reported as fine. The limits themselves are unverified, so the
 * banner says that too, instead of letting a quiet screen read as reassurance.
 */
export function CriticalBanner({ current, past, biomarkers, unwatched }: Props) {
  const sourceById = new Map(biomarkers.map((b) => [b.id, b.threshold_source]));
  const watched = biomarkers.length - unwatched.length;

  return (
    <div className="sec" data-testid="critical-banner">
      {current.length > 0 && (
        <div className="cbanner" role="alert">
          <div className="cbanner-hdr">
            Critical result{current.length === 1 ? '' : 's'} on the latest test ({current.length})
          </div>
          {current.map((f) => (
            <FindingLine key={`${f.biomarker_id}-${f.measured_at}`} f={f} source={sourceById.get(f.biomarker_id) ?? null} />
          ))}
          <div className="cb-note">Talk to a doctor about a flagged result. This app does not diagnose.</div>
        </div>
      )}

      {past.length > 0 && (
        <details className="cbanner cbanner-past" open={current.length === 0}>
          <summary className="cbanner-hdr cbanner-sum">
            Earlier result{past.length === 1 ? '' : 's'} that crossed a critical limit ({past.length})
          </summary>
          {past.map((f) => (
            <FindingLine key={`${f.biomarker_id}-${f.measured_at}`} f={f} source={sourceById.get(f.biomarker_id) ?? null} />
          ))}
          <div className="cb-note">These are historical. A later result exists for each of these markers.</div>
        </details>
      )}

      {current.length === 0 && past.length === 0 && (
        <div className="cbanner cbanner-none">
          <div className="ok-hdr">No stored critical limit crossed</div>
          <div className="oi">
            Checked {watched} of {biomarkers.length} markers that have a critical limit set.
          </div>
        </div>
      )}

      <div className="cb-caveat">
        Critical limits in this app have not been verified by a clinician, so a quiet banner is not an all clear.
        {unwatched.length > 0 && (
          <details className="cb-unwatched">
            <summary>
              {unwatched.length} marker{unwatched.length === 1 ? ' has' : 's have'} no critical limit and cannot be flagged
            </summary>
            <div>{unwatched.join(', ')}</div>
          </details>
        )}
      </div>
    </div>
  );
}
