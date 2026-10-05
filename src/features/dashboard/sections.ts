export type SectionId = 'today' | 'progress' | 'goals' | 'bloodwork' | 'supplements' | 'screening' | 'history';

export interface SectionMeta {
  id: SectionId;
  /** two-digit index shown in mono, also the keyboard shortcut */
  n: string;
  title: string;
  /** label for the phone tab bar */
  short: string;
  blurb: string;
}

/** The dashboard is one page; these are its sections in reading order. */
export const SECTIONS: readonly SectionMeta[] = [
  { id: 'today', n: '01', title: 'Today', short: 'Today', blurb: 'Log the day. It takes under a minute.' },
  { id: 'progress', n: '02', title: 'Progress', short: 'Progress', blurb: 'Your latest 30 entries, charted.' },
  { id: 'goals', n: '03', title: 'Goals and habits', short: 'Goals', blurb: 'Your target, daily targets and what you track.' },
  { id: 'bloodwork', n: '04', title: 'Bloodwork', short: 'Labs', blurb: 'Results from your lab reports, flagged against their reference ranges.' },
  { id: 'supplements', n: '05', title: 'Supplements', short: 'Supps', blurb: 'What you take, when, and what changed since you started.' },
  { id: 'screening', n: '06', title: 'Screening', short: 'Screening', blurb: 'Checks that are due for your age and sex, and when you last had them.' },
  { id: 'history', n: '07', title: 'History', short: 'History', blurb: 'Every day you logged, newest first.' },
];

/** Older links used #weight style tab names; anything unknown opens at the top. */
export function sectionFromHash(hash: string): SectionId | null {
  const id = hash.replace(/^#/, '');
  return SECTIONS.some((s) => s.id === id) ? (id as SectionId) : null;
}
