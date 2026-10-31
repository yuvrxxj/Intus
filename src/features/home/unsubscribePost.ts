// One-click unsubscribe (RFC 8058, INT-163). Mail apps such as Gmail show an "Unsubscribe" button for the
// List-Unsubscribe header, and press it by POSTing to the same https link that is in the email. intus.fit is a static
// site, so middleware.ts hands that POST to this, which asks the join-waitlist function to unsubscribe. A GET (a person
// opening the link) still loads the page. Pure: the caller passes fetch and the project address in.

import { UNSUBSCRIBE_PATH } from './route.ts';
import { interpretUnsubscribeResponse, unsubscribeParamsFrom, unsubscribePayload, waitlistFunctionUrl } from './waitlist.ts';

export const DEFAULT_SUPABASE_URL = 'https://zfyeqfnretrrmtevczrc.supabase.co';

export function isOneClickUnsubscribe(method: string, pathname: string): boolean {
  return method === 'POST' && (pathname.replace(/\/+$/, '') || '/') === UNSUBSCRIBE_PATH;
}

const text = (status: number, body: string) =>
  new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });

export async function oneClickUnsubscribe(requestUrl: string, fetcher: typeof fetch, supabaseUrl: string, publishableKey?: string): Promise<Response> {
  const params = unsubscribeParamsFrom(new URL(requestUrl).search);
  if (!params) return text(400, 'This unsubscribe link does not work.');
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (publishableKey) {
    headers.apikey = publishableKey;
    headers.authorization = `Bearer ${publishableKey}`;
  }
  let status = 0;
  let body: unknown = null;
  try {
    const res = await fetcher(waitlistFunctionUrl(supabaseUrl), { method: 'POST', headers, body: JSON.stringify(unsubscribePayload(params.id, params.t)) });
    status = res.status;
    body = await res.json().catch(() => null);
  } catch {
    status = 0;
  }
  const result = interpretUnsubscribeResponse(status, body);
  if (result === 'unsubscribed') return text(200, 'You are unsubscribed. We will not email you again.');
  if (result === 'invalid') return text(400, 'This unsubscribe link does not work.');
  return text(503, 'We could not unsubscribe you just now. Try again.');
}
