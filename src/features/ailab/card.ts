// Comparing the Bloodwork screen a model's rows would fill with the one the app's own on-device reader fills from the same
// report. Pure: the previews come from preview.ts. The screen is the part a person sees, so this counts what shows up on it:
// which tracked markers have a result, whether it is the same number, and whether it is flagged the same way.
import { CRITICAL } from '../../lib/safety.ts';
import type { RangeStatus } from '../bloodwork/model.ts';
import type { Preview } from './preview.ts';

export interface Shown {
  value: number;
  range: RangeStatus;
  critical: boolean;
}

/** The latest result for each tracked marker on the screen, by the marker's code. */
export function shownOn(preview: Preview): Map<string, Shown> {
  const shown = new Map<string, Shown>();
  for (const group of preview.view.groups) {
    for (const row of group.rows) {
      const code = row.biomarker.code;
      if (code) shown.set(code, { value: row.latest.value, range: row.range, critical: row.critical.status === CRITICAL.LOW || row.critical.status === CRITICAL.HIGH });
    }
  }
  return shown;
}

export interface ScreenScore {
  /** tracked markers with a result on the app's own screen, and on the model's */
  reference: number;
  model: number;
  /** on both screens with the same number */
  sameValue: number;
  /** on both screens with the same number and the same flag (in range, below, above, no range) */
  sameFlag: number;
  /** on the app's screen and not on the model's */
  missing: string[];
  /** on the model's screen and not on the app's */
  extra: string[];
  /** on both screens with a different number */
  differentValue: string[];
  /** same number, flagged differently */
  differentFlag: string[];
  /** out of range on the app's screen (below or above), and how many of those the model's screen flags the same way */
  concerns: number;
  concernsFlagged: number;
  /** flagged out of range on the model's screen but not on the app's */
  falseAlarms: string[];
  /** rows the review table would leave unticked, with the reason, for the model's rows */
  unticked: number;
}

export function compareScreens(reference: Preview, model: Preview): ScreenScore {
  const ref = shownOn(reference);
  const got = shownOn(model);
  const out: ScreenScore = { reference: ref.size, model: got.size, sameValue: 0, sameFlag: 0, missing: [], extra: [], differentValue: [], differentFlag: [], concerns: 0, concernsFlagged: 0, falseAlarms: [], unticked: model.left.length };
  const outOfRange = (s: Shown | undefined) => s?.range === 'below' || s?.range === 'above';
  for (const [code, r] of ref) {
    const m = got.get(code);
    if (outOfRange(r)) out.concerns++;
    if (!m) {
      out.missing.push(code);
      continue;
    }
    if (m.value !== r.value) {
      out.differentValue.push(code);
      continue;
    }
    out.sameValue++;
    if (m.range === r.range && m.critical === r.critical) out.sameFlag++;
    else out.differentFlag.push(code);
    if (outOfRange(r) && m.range === r.range) out.concernsFlagged++;
  }
  for (const [code, m] of got) {
    if (!ref.has(code)) out.extra.push(code);
    if (outOfRange(m) && !outOfRange(ref.get(code))) out.falseAlarms.push(code);
  }
  return out;
}
