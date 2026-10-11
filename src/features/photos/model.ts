// Photo check-ins: the rules that do not touch the browser or the network, so they can be tested on their own.
import { dayNumber } from '../../lib/dates.ts';

export const BUCKET = 'check-in-photos';

export const POSES = ['front', 'side', 'back', 'other'] as const;
export type Pose = (typeof POSES)[number];
export const POSE_LABEL: Record<Pose, string> = { front: 'Front', side: 'Side', back: 'Back', other: 'Other' };

/** These mirror the limits in supabase/migrations/20261009000200_photo_check_ins.sql; the database enforces them too. */
export const LIMITS = {
  /** the longest side after resizing, in pixels */
  maxEdge: 1280,
  quality: 0.82,
  maxBytes: 2 * 1024 * 1024,
  maxPhotos: 200,
  labelChars: 40,
  weightKg: { min: 20, max: 500 },
} as const;

/** What the database row holds, less the columns the screen does not use. */
export interface CheckIn {
  id: string;
  log_date: string;
  pose: Pose | null;
  label: string | null;
  weight: number | null;
  storage_path: string | null;
}

export type ImageType = 'image/jpeg' | 'image/webp';

export function extensionFor(type: string): 'jpg' | 'webp' | null {
  if (type === 'image/jpeg') return 'jpg';
  if (type === 'image/webp') return 'webp';
  return null;
}

/** <user id>/<photo id>.jpg: the only shape the bucket's policies accept. */
export function objectPath(userId: string, photoId: string, type: string): string {
  const ext = extensionFor(type);
  if (!ext) throw new Error(`Photos are saved as JPEG or WebP, not ${type || 'an unknown type'}`);
  return `${userId}/${photoId}.${ext}`;
}

/** The size to draw a picture at: the longest side is at most maxEdge, the shape is kept, and a small picture is never enlarged. */
export function fitWithin(width: number, height: number, maxEdge: number = LIMITS.maxEdge): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) throw new Error('The picture has no size');
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width: Math.round(width), height: Math.round(height) };
  const scale = maxEdge / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export interface CheckInForm {
  date: string;
  pose: string;
  label: string;
  weight: string;
}

export interface CheckInValues {
  log_date: string;
  pose: Pose;
  label: string | null;
  weight: number | null;
}

export type CheckInErrors = Partial<Record<keyof CheckInForm, string>>;
export type CheckInResult = { ok: true; value: CheckInValues } | { ok: false; errors: CheckInErrors };

export function isPose(value: string): value is Pose {
  return (POSES as readonly string[]).includes(value);
}

/** Turns the form into a row's values, or says what is wrong. today is passed in so the result never depends on the clock. */
export function validateCheckIn(form: CheckInForm, today: string): CheckInResult {
  const errors: CheckInErrors = {};

  const date = form.date.trim();
  if (date === '') {
    errors.date = 'Choose the date of the photo';
  } else {
    try {
      if (dayNumber(date) > dayNumber(today)) errors.date = 'The photo cannot be from a day that has not happened yet';
    } catch {
      errors.date = 'That is not a valid date';
    }
  }

  if (!isPose(form.pose)) errors.pose = 'Choose front, side, back or other';

  const label = form.label.trim();
  if (label.length > LIMITS.labelChars) errors.label = `Keep the note to ${LIMITS.labelChars} characters or fewer`;

  let weight: number | null = null;
  const rawWeight = form.weight.trim();
  if (rawWeight !== '') {
    const n = Number(rawWeight);
    const { min, max } = LIMITS.weightKg;
    if (!Number.isFinite(n) || n < min || n > max) errors.weight = `Enter a weight between ${min} and ${max} kg, or leave it blank`;
    else weight = Math.round(n * 10) / 10;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { log_date: date, pose: form.pose as Pose, label: label === '' ? null : label, weight } };
}

/** Newest first; photos on the same day keep a steady order by pose, then id. */
export function newestFirst(entries: readonly CheckIn[]): CheckIn[] {
  const poseOrder = (p: Pose | null) => (p === null ? POSES.length : POSES.indexOf(p));
  return [...entries].sort((a, b) =>
    b.log_date.localeCompare(a.log_date) || poseOrder(a.pose) - poseOrder(b.pose) || a.id.localeCompare(b.id));
}

export interface Comparison {
  before: CheckIn;
  after: CheckIn;
  /** whole days between the two photos */
  days: number;
  /** after minus before in kg, or null when either photo has no weight */
  weightChange: number | null;
}

/**
 * The earliest and the latest photo of one pose, so the same angle is set against itself. Null when there are
 * fewer than two on different days. Only photos that still have a picture count.
 */
export function compareEnds(entries: readonly CheckIn[], pose: Pose): Comparison | null {
  const same = entries.filter((e) => e.pose === pose && e.storage_path !== null).sort((a, b) => a.log_date.localeCompare(b.log_date) || a.id.localeCompare(b.id));
  if (same.length < 2) return null;
  const before = same[0];
  const after = same[same.length - 1];
  if (before.log_date === after.log_date) return null;
  const weightChange = before.weight !== null && after.weight !== null ? Math.round((after.weight - before.weight) * 10) / 10 : null;
  return { before, after, days: dayNumber(after.log_date) - dayNumber(before.log_date), weightChange };
}

/** "84 days apart", "1 day apart". */
export function daysApart(days: number): string {
  return `${days} ${days === 1 ? 'day' : 'days'} apart`;
}

/** "-3.2 kg", "+0.4 kg", "no change", or null when it cannot be worked out. Says nothing about whether the change is good. */
export function describeWeightChange(change: number | null): string | null {
  if (change === null) return null;
  if (change === 0) return 'no change in weight';
  return `${change > 0 ? '+' : '-'}${Math.abs(change).toFixed(1)} kg`;
}

export function roomFor(count: number): number {
  return Math.max(0, LIMITS.maxPhotos - count);
}

/** Why a chosen file cannot be used, or null when it can be tried. The browser has the last word when it decodes it. */
export function fileProblem(file: { type: string; size: number; name?: string }): string | null {
  if (file.size === 0) return 'That file is empty';
  if (file.type !== '' && !file.type.startsWith('image/')) return 'Choose a photo (JPEG, PNG or WebP)';
  // a phone photo can be 10 MB or more; it is shrunk before saving, but a huge file would stall the page
  if (file.size > 40 * 1024 * 1024) return 'That photo is too large. Choose one under 40 MB';
  return null;
}
