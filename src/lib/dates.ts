const MS_PER_DAY = 86400000;

export function isoDay(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Whole days since 1970-01-01 for a 'YYYY-MM-DD' string, or for the local calendar day of a Date. */
export function dayNumber(input: Date | string): number {
  if (input instanceof Date) {
    // a Date means the user's calendar day, so read local parts
    const day = Date.UTC(input.getFullYear(), input.getMonth(), input.getDate()) / MS_PER_DAY;
    if (!Number.isFinite(day)) throw new TypeError(`Invalid date: ${input}`);
    return day;
  }
  const text = String(input).slice(0, 10);
  const [y, m, d] = text.split('-').map(Number);
  const day = Date.UTC(y, m - 1, d) / MS_PER_DAY;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(day) || isoDay(day) !== text) {
    throw new TypeError(`Invalid date: ${input}`);
  }
  return day;
}
