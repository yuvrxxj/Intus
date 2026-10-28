// Browser calls to the join-waitlist edge function. The function is not deployed with the pull request that adds it.

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../../db/client.ts';
import {
  confirmPayload,
  interpretConfirmResponse,
  interpretJoinResponse,
  interpretResendResponse,
  payloadFrom,
  resendPayload,
  waitlistFunctionUrl,
  answersPayload,
  interpretAnswersResponse,
  type AnswersOutcome,
  type ConfirmPageResult,
  type Device,
  type JoinOutcome,
  type ResendOutcome,
  type WaitlistState,
} from './waitlist.ts';

function offlineNow(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

async function post(body: unknown, fetcher: typeof fetch): Promise<{ status: number; body: unknown }> {
  try {
    const res = await fetcher(waitlistFunctionUrl(SUPABASE_URL), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: SUPABASE_PUBLISHABLE_KEY,
        authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    try {
      return { status: res.status, body: text ? JSON.parse(text) as unknown : null };
    } catch {
      return { status: res.status, body: null };
    }
  } catch {
    return { status: 0, body: null };
  }
}

export function submitJoin(state: WaitlistState, fetcher: typeof fetch = fetch): Promise<JoinOutcome> {
  return post(payloadFrom(state), fetcher).then((posted) => interpretJoinResponse(posted.status, posted.body, offlineNow()));
}

export function submitConfirm(token: string, fetcher: typeof fetch = fetch): Promise<ConfirmPageResult> {
  return post(confirmPayload(token), fetcher).then((posted) => interpretConfirmResponse(posted.status, posted.body));
}

export function submitAnswers(token: string, device: Device, tracks: string, fetcher: typeof fetch = fetch): Promise<AnswersOutcome> {
  return post(answersPayload(token, device, tracks), fetcher).then((posted) => interpretAnswersResponse(posted.status, posted.body));
}

export function submitResend(email: string, fetcher: typeof fetch = fetch): Promise<ResendOutcome> {
  return post(resendPayload(email), fetcher).then((posted) => interpretResendResponse(posted.status, posted.body, offlineNow()));
}
