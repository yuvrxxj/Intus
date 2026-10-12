import { useState, type ChangeEvent } from 'react';
import { supabase } from '../../db/client.ts';
import { toRows } from './appleHealth.ts';
import { scanExportFile } from './readExport.ts';

/** How far back an import reads. A year of nights is plenty for every summary on the screen. */
const DAYS_BACK = 365;
const BATCH = 500;

async function upsertAll(table: 'sleep_sessions' | 'cardio_metrics', rows: readonly object[], onConflict: string): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + BATCH) as never, { onConflict });
    if (error) throw new Error(error.message);
  }
}

/**
 * Import sleep and heart readings from the file the Health app exports. It is read on this device; only the sleep
 * sessions and the daily heart readings worked out from it are saved. Importing the same export again changes nothing.
 */
export function ImportAppleHealth({ onDone, notify }: { onDone: () => void; notify: (message: string, error?: boolean) => void }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy('Opening the export');
    try {
      const since = new Date(Date.now() - DAYS_BACK * 86_400_000);
      const scan = await scanExportFile(file, since, setBusy);
      setBusy('Saving');
      const rows = toRows(scan, new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone ?? null);
      if (rows.sleep.length === 0 && rows.cardio.length === 0) {
        notify('No sleep or heart readings from the last year were found in that export', true);
        return;
      }
      await upsertAll('sleep_sessions', rows.sleep, 'user_id,source_kind,source_name,external_id');
      await upsertAll('cardio_metrics', rows.cardio, 'user_id,measured_at,source');
      notify(`Imported ${rows.sleep.length} night${rows.sleep.length === 1 ? '' : 's'} of sleep and ${rows.cardio.length} day${rows.cardio.length === 1 ? '' : 's'} of heart readings`);
      onDone();
    } catch (e) {
      notify(`The export could not be imported: ${e instanceof Error ? e.message : String(e)}`, true);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card sec" aria-labelledby="ah-title">
      <div className="ct" id="ah-title"><span className="dot dot-dim" />Import from Apple Health</div>
      <p className="mt-1 text-sm leading-relaxed text-ink-2">
        On your iPhone: Health, your picture, Export All Health Data. Send the zip to this computer and choose it here.
        It is read on this device; only sleep and daily heart readings from the last year are saved, and importing again adds nothing twice.
      </p>
      {busy ? (
        <div className="loading" role="status">{busy}</div>
      ) : (
        <label className="btn mt-3 inline-block cursor-pointer">
          <input type="file" accept=".zip,.xml,application/zip,text/xml" className="sr-only" onChange={pick} />
          Choose export.zip
        </label>
      )}
    </section>
  );
}
