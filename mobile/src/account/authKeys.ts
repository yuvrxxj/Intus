/** Host segment Supabase uses in the default keychain name: `sb-<ref>-auth-token`. */
export function authStorageKey(supabaseUrl: string): string {
  const host = new URL(supabaseUrl).hostname.split('.')[0];
  if (!host) throw new Error('The Supabase address has no host');
  return `sb-${host}-auth-token`;
}

/** Fixed keychain names the signed-in client writes. A storage adapter cannot list keys, so deletion names them. */
export function authStorageKeys(supabaseUrl: string): string[] {
  const base = authStorageKey(supabaseUrl);
  return [base, `${base}-user`, `${base}-code-verifier`, flowsIndexKey(supabaseUrl)];
}

/** The index of in-progress sign-in verifiers. The ids themselves are not knowable without reading it. */
export function flowsIndexKey(supabaseUrl: string): string {
  return `${authStorageKey(supabaseUrl)}-flows-code-verifier`;
}

const FLOW_ID = /^[a-zA-Z0-9_-]{8,64}$/;

/**
 * Verifier slots named in the flows index. The client stores that index as JSON. A missing or unreadable index
 * adds nothing, and an id that is not the shape the client generates is ignored.
 */
export function pkceVerifierKeys(supabaseUrl: string, indexRaw: string | null): string[] {
  if (!indexRaw) return [];
  try {
    const parsed = JSON.parse(indexRaw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const base = authStorageKey(supabaseUrl);
    return parsed.filter((id): id is string => typeof id === 'string' && FLOW_ID.test(id)).map((id) => `${base}-flow-${id}-code-verifier`);
  } catch {
    return [];
  }
}

/** Every keychain entry to remove for this project, plus the app's own keys (the last sync, for example). */
export function keysToClear(supabaseUrl: string, flowsIndexRaw: string | null, extra: readonly string[]): string[] {
  return [...new Set([...authStorageKeys(supabaseUrl), ...pkceVerifierKeys(supabaseUrl, flowsIndexRaw), ...extra])];
}
