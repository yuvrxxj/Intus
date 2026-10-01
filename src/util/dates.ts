const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** The user's calendar day as 'YYYY-MM-DD', from local time parts so it never slips a day around midnight. */
export function todayKey(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** '2026-06-07' becomes '7 Jun'. */
export function shortDate(key: string): string {
  const [, month, day] = key.split('-');
  return `${parseInt(day, 10)} ${MONTHS[parseInt(month, 10) - 1]}`;
}

export function isSunday(now: Date = new Date()): boolean {
  return now.getDay() === 0;
}

export function clockParts(now: Date): { date: string; time: string } {
  return {
    date: `${WEEKDAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]}`,
    time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  };
}
