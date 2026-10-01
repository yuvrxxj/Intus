import { PARACETAMOL, type ParacetamolTotal } from '../../lib/drugChecks.ts';

const fmt = (n: number) => n.toLocaleString('en-US');

const TITLE: Record<string, string> = {
  [PARACETAMOL.NONE]: 'Nothing recorded for today',
  [PARACETAMOL.OK]: 'Below the caution line',
  [PARACETAMOL.CAUTION]: 'Check the total before taking more',
  [PARACETAMOL.EXCEEDED]: 'Over the adult label maximum',
  [PARACETAMOL.INCOMPLETE]: 'Cannot be totalled',
};

/** What the check says, in words. Shared by the card and the alert at the top of the app. */
export function paracetamolMessage(total: ParacetamolTotal): string {
  const { status, totalMg, limits, incomplete } = total;
  switch (status) {
    case PARACETAMOL.EXCEEDED:
      return `${fmt(totalMg)} mg recorded today, over the ${fmt(limits.maxMg)} mg adult label maximum. Do not take more paracetamol today and speak to a pharmacist or doctor.`;
    case PARACETAMOL.CAUTION:
      return `${fmt(totalMg)} mg recorded today, at or above ${fmt(limits.cautionMg)} mg. Check the total before taking more. The adult label maximum is ${fmt(limits.maxMg)} mg.`;
    case PARACETAMOL.INCOMPLETE:
      return `${incomplete.join(', ')} ${incomplete.length === 1 ? 'has' : 'have'} no dose or frequency, so today's total is too low. Fill it in so it can be counted.`;
    default:
      return '';
  }
}

export function ParacetamolCard({ total }: { total: ParacetamolTotal }) {
  const { status, totalMg, limits, items, incomplete } = total;
  const pct = Math.min(100, (totalMg / limits.maxMg) * 100);
  const tone =
    status === PARACETAMOL.EXCEEDED ? 'bad'
    : status === PARACETAMOL.CAUTION || status === PARACETAMOL.INCOMPLETE ? 'warn'
    : status === PARACETAMOL.NONE ? 'none'
    : 'ok';

  return (
    <div className="card sec" data-testid="paracetamol-card">
      <div className="ct"><span className={`dot ${tone === 'bad' ? 'dot-red' : tone === 'warn' ? 'dot-yellow' : tone === 'none' ? 'dot-dim' : 'dot-green'}`} />Paracetamol today</div>
      <div className="pc-head">
        <div className="pc-total">{fmt(totalMg)}<span className="pc-unit"> mg</span></div>
        <div>
          <div className={`pc-title pc-${tone}`}>{TITLE[status]}</div>
          <div className="pc-sub">of {fmt(limits.maxMg)} mg adult label maximum</div>
        </div>
      </div>
      <div className="pc-bar" role="img" aria-label={`${fmt(totalMg)} of ${fmt(limits.maxMg)} milligrams`}>
        <div className={`pc-fill pc-fill-${tone}`} style={{ width: `${pct}%` }} />
        <div className="pc-tick" style={{ left: `${(limits.cautionMg / limits.maxMg) * 100}%` }} title={`${fmt(limits.cautionMg)} mg caution line`} />
      </div>

      {(status === PARACETAMOL.EXCEEDED || status === PARACETAMOL.CAUTION || status === PARACETAMOL.INCOMPLETE) && (
        <div className={`notice notice-${status === PARACETAMOL.EXCEEDED ? 'bad' : 'warn'}`} role="alert">{paracetamolMessage(total)}</div>
      )}
      {status === PARACETAMOL.EXCEEDED && incomplete.length > 0 && (
        <div className="notice notice-warn">{incomplete.join(', ')} could not be counted, so the real total is higher.</div>
      )}

      {items.length > 0 && (
        <ul className="pc-list">
          {items.map((i) => (
            <li key={i.name}>
              <span>{i.name}</span>
              <span className="pc-calc">{fmt(i.mgPerDose)} mg × {i.dosesPerDay} = {fmt(i.dailyMg)} mg</span>
            </li>
          ))}
        </ul>
      )}
      {status === PARACETAMOL.NONE && <div className="empty">Nothing with paracetamol is recorded as taken today.</div>}

      <div className="pc-foot">
        This adds up what you entered, nothing more. Cold and flu remedies and combination painkillers often contain paracetamol, so check
        their labels and add them below. Your own limit may be lower than the label maximum, and a pharmacist or doctor can tell you.
      </div>
    </div>
  );
}
