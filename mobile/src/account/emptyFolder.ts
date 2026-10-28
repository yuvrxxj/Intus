import { removeAll } from '../../../src/features/photos/removeAll.ts';

/**
 * Empties one person's folder in a private bucket and proves it is empty. `missingBucketIsEmpty` matches uploaded
 * lab reports: before that bucket exists there is nothing to remove, and that must not block deleting an account.
 * Photos do not use it. Paths are `<folder>/<file>`, the only shape the bucket policies accept.
 */
export async function emptyStorageFolder(
  folder: string,
  deps: {
    list: () => Promise<{ names: string[]; error: string | null }>;
    remove: (paths: string[]) => Promise<{ error: string | null }>;
    missingBucketIsEmpty?: boolean;
  },
): Promise<void> {
  await removeAll({
    list: async () => {
      const listed = await deps.list();
      if (listed.error && deps.missingBucketIsEmpty && /bucket not found/i.test(listed.error)) return [];
      if (listed.error) throw new Error(listed.error);
      return listed.names;
    },
    remove: async (names) => {
      const result = await deps.remove(names.map((name) => `${folder}/${name}`));
      if (result.error) throw new Error(result.error);
    },
  });
}
