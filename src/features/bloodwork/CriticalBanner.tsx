import type { CriticalFinding } from '../../lib/safety.ts';
import { CRITICAL } from '../../lib/safety.ts';
import { formatDay, formatValue } from './format.ts';

interface Props {
  current: readonly CriticalFinding[];
  past: readonly CriticalFinding[];
}

function limitCrossed(f: CriticalFinding): string {
  return f.status === CRITICAL.LOW
    ? `at or below the critical low limit of ${formatValue(f.critical_low ?? NaN)}`
    : `at or above the critical high limit of ${formatValue(f.critical_high ?? NaN)}`;
}

function FindingLine({ f }: { f: CriticalFinding }) {
  return (
    <div className="ci">
      <span>
        <strong>{f.name ?? f.code}</strong> {formatValue(f.value)} {f.unit} on {formatDay(f.measured_at)}, {limitCrossed(f)}.
      </span>
    </div>
  );
}

/** The first thing on the screen when a result crossed a critical limit. With nothing crossed it draws nothing. */
export function CriticalBanner({ current, past }: Props) {
  if (current.length === 0 && past.length === 0) return null;

  return (
    <div className="sec" data-testid="critical-banner">
      {current.length > 0 && (
        <div className="cbanner" role="alert">
          <div className="cbanner-hdr">
            Critical result{current.length === 1 ? '' : 's'} on the latest test ({current.length})
          </div>
          {current.map((f) => (
            <FindingLine key={`${f.biomarker_id}-${f.measured_at}`} f={f} />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <details className="cbanner cbanner-past" open={current.length === 0}>
          <summary className="cbanner-hdr cbanner-sum">
            Earlier result{past.length === 1 ? '' : 's'} that crossed a critical limit ({past.length})
          </summary>
          {past.map((f) => (
            <FindingLine key={`${f.biomarker_id}-${f.measured_at}`} f={f} />
          ))}
          <div className="cb-note">A later result exists for each of these markers.</div>
        </details>
      )}
    </div>
  );
}
