import type { Profile } from '../../db/profile.ts';
import { DIRECTION_LABEL, type Programme } from '../../lib/programme.ts';
import { normalizeSex } from '../screening/model.ts';

/** The page title: the person's own name when they have given one. */
export function titleFor(profile: Pick<Profile, 'name'> | null): string {
  const name = profile?.name?.trim();
  if (!name) return 'Health OS';
  return `${name}'${name.toLowerCase().endsWith('s') ? '' : 's'} Health OS`;
}

/** The short line under the title, for example "26M · 179cm · B+ · Cut: 82→75kg". Leaves out whatever is not known. */
export function profileLine(
  profile: Pick<Profile, 'age' | 'sex' | 'height_cm' | 'blood_type'> | null,
  programme: Programme | null,
): string {
  const parts: string[] = [];
  if (profile) {
    const sex = normalizeSex(profile.sex);
    const demographic = `${profile.age ?? ''}${sex === 'male' ? 'M' : sex === 'female' ? 'F' : ''}`;
    if (demographic) parts.push(demographic);
    if (profile.height_cm != null && Number(profile.height_cm) > 0) parts.push(`${Number(profile.height_cm)}cm`);
    if (profile.blood_type) parts.push(profile.blood_type);
  }
  if (programme) {
    parts.push(`${DIRECTION_LABEL[programme.direction]}: ${programme.startWeightKg}→${programme.goalWeightKg}kg`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'Add your details and goal to get started';
}
