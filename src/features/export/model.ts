// "Download my data": everything a person has stored, in one file they can keep. Pure, so it can be tested.

/** Every table that holds a person's own rows (supabase/README.md, "Personal"). A new one must be added here. */
export const PERSONAL_TABLES = [
  'profile', 'daily_logs', 'habits', 'biomarker_readings', 'medications', 'sleep_sessions', 'cardio_metrics',
  'cycle_days', 'profile_conditions', 'workouts', 'workout_sets', 'photo_log', 'body_composition', 'meals', 'diagnoses', 'devices', 'action_items', 'supplement_catalog',
] as const;

export type PersonalTable = (typeof PERSONAL_TABLES)[number];

export interface ExportInput {
  email: string | null;
  exportedAt: Date;
  tables: Record<PersonalTable, readonly Record<string, unknown>[]>;
  /** marker id to code, name and unit, so readings make sense without the shared table */
  biomarkers: readonly { id: string; code: string; name: string; unit: string }[];
  /** names of the stored files (photos, reports); the files themselves are opened in the app */
  files: { photos: readonly string[]; reports: readonly string[] };
}

/**
 * One JSON document. Rows are kept exactly as stored, except that the owner's id is taken out (it means nothing
 * outside Intus) and each blood result also says which marker it is, by code, name and unit.
 */
export function buildExport(input: ExportInput): Record<string, unknown> {
  const markers = new Map(input.biomarkers.map((b) => [b.id, b]));
  const strip = (row: Record<string, unknown>) => {
    const { user_id: _drop, ...rest } = row;
    void _drop;
    return rest;
  };
  const tables: Record<string, unknown[]> = {};
  for (const name of PERSONAL_TABLES) {
    const rows = input.tables[name] ?? [];
    tables[name] =
      name === 'biomarker_readings'
        ? rows.map((r) => {
            const m = markers.get(String(r.biomarker_id));
            return { ...strip(r), marker: m ? { code: m.code, name: m.name, unit: m.unit } : null };
          })
        : rows.map(strip);
  }
  return {
    about: 'Everything you stored in Intus, as it was on the date below. Times are UTC. Photos and uploaded reports are listed by file name; open them in the app to save them.',
    app: 'Intus',
    format: 1,
    exported_at: input.exportedAt.toISOString(),
    account: { email: input.email },
    counts: Object.fromEntries(PERSONAL_TABLES.map((t) => [t, (input.tables[t] ?? []).length])),
    tables,
    files: input.files,
  };
}

export function exportFileName(at: Date): string {
  return `intus-data-${at.toISOString().slice(0, 10)}.json`;
}
