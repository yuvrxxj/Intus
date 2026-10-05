const PAGE_SIZE = 1000;

/**
 * PostgREST caps a response at 1000 rows without saying so. For anything a safety check reads, a silent cut would
 * mean a critical reading could go unseen, so this pages until a short page comes back.
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  label: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Could not load ${label}: ${error.message}`);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
}
