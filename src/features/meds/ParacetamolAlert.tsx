import { PARACETAMOL, type ParacetamolTotal } from '../../lib/drugChecks.ts';
import { paracetamolMessage } from './ParacetamolCard.tsx';

/**
 * Shown above the tabs, on every screen, when today's total needs attention. Quiet when everything is fine, but not
 * when the check itself cannot run: a failed check that said nothing would read as "no paracetamol today".
 */
export function ParacetamolAlert({ total, unavailable, onOpen }: {
  total: ParacetamolTotal | null;
  unavailable: string | null;
  onOpen: () => void;
}) {
  if (unavailable) {
    return (
      <div className="notice notice-warn pc-alert" role="alert">
        <strong>Paracetamol check unavailable.</strong> {unavailable}{' '}
        <button type="button" className="btn pc-alert-btn" onClick={onOpen}>Open medications</button>
      </div>
    );
  }
  if (!total || total.status === PARACETAMOL.NONE || total.status === PARACETAMOL.OK) return null;
  const bad = total.status === PARACETAMOL.EXCEEDED;
  return (
    <div className={`notice ${bad ? 'notice-bad' : 'notice-warn'} pc-alert`} role="alert">
      <strong>Paracetamol today.</strong> {paracetamolMessage(total)}{' '}
      <button type="button" className="btn pc-alert-btn" onClick={onOpen}>Open medications</button>
    </div>
  );
}
