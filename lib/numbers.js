/**
 * Supabase returns numeric columns as strings, and Number(null) or Number('') is 0, which would
 * silently turn a missing value into a real one. Everything numeric goes through here.
 */
export function toNumber(input, label) {
  if (typeof input === 'number') {
    if (Number.isFinite(input)) return input;
  } else if (typeof input === 'string' && input.trim() !== '') {
    const parsed = Number(input);
    if (Number.isFinite(parsed)) return parsed;
  }
  throw new TypeError(`${label} must be a finite number, got ${JSON.stringify(input)}`);
}

export function toNumberOrNull(input, label) {
  return input == null ? null : toNumber(input, label);
}
