import type { AsciiShape } from '../../components/ui/ascii-engine.ts';

/** The pages of the signed-in app. The first six are in the top bar, in this order; Account sits at its right. */
export type PageId = 'dashboard' | 'today' | 'goals' | 'bloodwork' | 'supplements' | 'progress' | 'account';

export interface PageMeta {
  id: PageId;
  /** two-digit index shown in mono; also the number key that opens the page */
  n: string;
  title: string;
  /** the word in the top bar */
  short: string;
  blurb: string;
  /** the artwork on the page. The dashboard has the heart beside its greeting, and the ribs down its left side */
  art: AsciiShape;
}

export const PAGES: readonly PageMeta[] = [
  { id: 'dashboard', n: '01', title: 'Dashboard', short: 'Dashboard', blurb: 'Where you stand today.', art: 'heart' },
  { id: 'today', n: '02', title: 'Today', short: 'Today', blurb: 'Log the day, then see last night\'s sleep and what you ate.', art: 'hourglass' },
  { id: 'goals', n: '03', title: 'Goals and habits', short: 'Goals', blurb: 'Your details, your target, your daily targets, what you track and your photo check-ins.', art: 'target' },
  { id: 'bloodwork', n: '04', title: 'Bloodwork', short: 'Bloodwork', blurb: 'Results from your lab reports, flagged against their reference ranges.', art: 'vials' },
  { id: 'supplements', n: '05', title: 'Supplements', short: 'Supplements', blurb: 'What you take, when, and what changed since you started.', art: 'bottle' },
  { id: 'progress', n: '06', title: 'Progress', short: 'Progress', blurb: 'Your latest 30 entries, charted, with a way into the full history of each.', art: 'stairs' },
  { id: 'account', n: '07', title: 'Account', short: 'Account', blurb: 'Who is signed in, your data, and how to delete your account.', art: 'cube' },
];

/** The pages in the top bar's main list. */
export const NAV_PAGES: readonly PageMeta[] = PAGES.filter((p) => p.id !== 'account');

export const DEFAULT_PAGE: PageId = 'dashboard';

/** Addresses from before the page split still open somewhere sensible. */
const LEGACY: Record<string, PageId> = { sleep: 'today', history: 'progress', screening: 'dashboard', overview: 'dashboard' };

/** '#today' to 'today'; an old section name to the page that holds it; anything else to null. */
export function pageFromHash(hash: string): PageId | null {
  const id = hash.replace(/^#\/?/, '');
  if (PAGES.some((p) => p.id === id)) return id as PageId;
  return LEGACY[id] ?? null;
}

export const pageMeta = (id: PageId): PageMeta => PAGES.find((p) => p.id === id)!;

/** The size every page's artwork is drawn at (characters). The tests check no shape is clipped at this size. */
export const PAGE_ART_COLS = 52;
export const PAGE_ART_ROWS = 26;
