/**
 * Removes every file in a folder through the Storage API, and proves it. Storage answers a delete it was not allowed
 * to make with an empty list and no error, so the only honest check is to list again: each round must leave fewer
 * files than the last, and the folder must end up empty. Used before an account is deleted, so a stuck delete stops
 * the deletion instead of leaving someone's photos behind with no account to own them.
 */
export async function removeAll(
  deps: { list: () => Promise<string[]>; remove: (names: string[]) => Promise<void> },
  maxRounds = 50,
): Promise<void> {
  let previous = Number.POSITIVE_INFINITY;
  for (let round = 0; round < maxRounds; round += 1) {
    const names = await deps.list();
    if (names.length === 0) return;
    if (names.length >= previous) throw new Error(`${names.length} of your photos could not be removed`);
    previous = names.length;
    await deps.remove(names);
  }
  throw new Error('Your photos could not all be removed');
}
