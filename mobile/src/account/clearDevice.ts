/**
 * Removes what the app kept on the phone. Like the website's clearLocalData, a store that cannot be cleared does not
 * throw: the account is already gone, and a failure here must not look like the deletion failed.
 */
export async function clearDevice(deps: {
  secureKeys: readonly string[];
  deleteSecure: (key: string) => Promise<void>;
  clearAsync: () => Promise<void>;
  clearCache: () => Promise<void>;
}): Promise<void> {
  for (const key of deps.secureKeys) {
    try {
      await deps.deleteSecure(key);
    } catch {
      // a missing keychain entry has nothing to clear
    }
  }
  try {
    await deps.clearAsync();
  } catch {
    // async storage may be empty or unavailable
  }
  try {
    await deps.clearCache();
  } catch {
    // the cache is disposable; the system deletes it too
  }
}
