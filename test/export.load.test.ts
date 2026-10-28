import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildExport } from '../src/features/export/model.ts';
import { loadExport, type ExportLoad } from '../src/features/export/load.ts';

const quiet = {
  photosBucket: 'check-in-photos',
  reportsBucket: 'lab-reports',
  biomarkers: async () => ({ data: [], error: null }),
  list: async () => ({ names: [], error: null }),
};

test('a signed-out download is refused before anything is read', async () => {
  let called = false;
  await assert.rejects(
    () => loadExport({ ...quiet, userId: null, pageTable: async () => { called = true; return { data: [], error: null }; } }),
    /You are signed out\. Sign in again to download your data/,
  );
  assert.equal(called, false);
});

test('a table longer than one page is read until a short page comes back', async () => {
  const calls: [string, number, number][] = [];
  const full = Array.from({ length: 1000 }, (_, i) => ({ id: String(i), user_id: 'u' }));
  const loaded = await loadExport({
    ...quiet,
    userId: 'user-1',
    pageTable: async (table, from, to) => {
      calls.push([table, from, to]);
      if (table !== 'habits') return { data: [], error: null };
      if (from === 0) return { data: full, error: null };
      return { data: [{ id: 'last', user_id: 'u', name: 'Walk' }], error: null };
    },
  });
  assert.deepEqual(calls.filter(([table]) => table === 'habits'), [['habits', 0, 999], ['habits', 1000, 1999]]);
  assert.equal(loaded.tables.habits.length, 1001);
  assert.equal(loaded.tables.profile.length, 0);
});

test('a failed table read names the table, and a failed marker read names the list', async () => {
  await assert.rejects(
    () => loadExport({
      ...quiet,
      userId: 'user-1',
      pageTable: async (table) => ({ data: null, error: table === 'habits' ? { message: 'boom' } : null }),
    }),
    /Could not load habits: boom/,
  );
  await assert.rejects(
    () => loadExport({
      ...quiet,
      userId: 'user-1',
      pageTable: async () => ({ data: [], error: null }),
      biomarkers: async () => ({ data: null, error: { message: 'no markers' } }),
    }),
    /Could not load the markers list: no markers/,
  );
});

test('a missing storage bucket is an empty file list, and any other list error stops the download', async () => {
  const loaded = await loadExport({
    ...quiet,
    userId: 'user-1',
    pageTable: async () => ({ data: [], error: null }),
    list: async (bucket) => bucket === 'lab-reports'
      ? { names: [], error: 'Bucket not found' }
      : { names: ['a.webp'], error: null },
  });
  assert.deepEqual(loaded.files, { photos: ['a.webp'], reports: [] });
  await assert.rejects(
    () => loadExport({
      ...quiet,
      userId: 'user-1',
      pageTable: async () => ({ data: [], error: null }),
      list: async () => ({ names: [], error: 'permission denied' }),
    }),
    /permission denied/,
  );
});

test('the loaded rows are the ones the shared export formats, without the owner id', async () => {
  const loaded: ExportLoad = await loadExport({
    ...quiet,
    userId: 'user-1',
    pageTable: async (table) => table === 'habits'
      ? { data: [{ id: 'h', user_id: 'user-1', name: 'Walk' }], error: null }
      : { data: [], error: null },
    biomarkers: async () => ({ data: [{ id: 'b1', code: 'hemoglobin', name: 'Hemoglobin', unit: 'g/dL' }], error: null }),
    list: async () => ({ names: ['p.webp'], error: null }),
  });
  const at = new Date('2026-10-28T00:00:00.000Z');
  const out = buildExport({ email: 'a@example.test', exportedAt: at, ...loaded }) as { tables: { habits: { user_id?: string; name: string }[] }; format: number };
  assert.equal(out.format, 1);
  assert.deepEqual(out.tables.habits, [{ id: 'h', name: 'Walk' }]);
  assert.equal(JSON.stringify(out).includes('"user_id"'), false);
});
