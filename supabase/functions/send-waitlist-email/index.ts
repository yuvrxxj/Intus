// Supabase Edge Function: send the "place ready" or "launch" email to the waitlist (INT-163). Deployed by hand, and not
// deployed with this change. See supabase/README.md. Deploy with --no-verify-jwt: the handler checks the x-admin-token
// header against the secret WAITLIST_ADMIN_TOKEN itself, and refuses everything while that secret is unset.
//
// Secrets, set in the Supabase dashboard and never in code: WAITLIST_ADMIN_TOKEN, RESEND_API_KEY,
// WAITLIST_UNSUBSCRIBE_SECRET, WAITLIST_POSTAL_ADDRESS, WAITLIST_TESTFLIGHT_URL (place_ready), WAITLIST_STORE_URL
// (launch), and the shared gate WAITLIST_EMAIL_LIVE / WAITLIST_EMAIL_ALLOWLIST. SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { mailGateFrom, postResend } from '../_shared/resendMail.ts';
import { createSendHandler, type Recipient } from './handler.ts';

const env = (name: string) => Deno.env.get(name) || undefined;

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const apiKey = env('RESEND_API_KEY');

Deno.serve(createSendHandler({
  config: {
    adminToken: env('WAITLIST_ADMIN_TOKEN'),
    apiKey,
    unsubscribeSecret: env('WAITLIST_UNSUBSCRIBE_SECRET'),
    testflightUrl: env('WAITLIST_TESTFLIGHT_URL'),
    storeUrl: env('WAITLIST_STORE_URL'),
    postalAddress: env('WAITLIST_POSTAL_ADDRESS'),
    ...mailGateFrom(env),
  },
  countCandidates: async (kind, only) => {
    const { data, error } = await admin.rpc('waitlist_email_candidate_count', { p_kind: kind, p_only: only });
    if (error || typeof data !== 'number') throw new Error('count failed');
    return data;
  },
  listRecipients: async (kind, limit, only) => {
    const { data, error } = await admin.rpc('waitlist_email_recipients', { p_kind: kind, p_limit: limit, p_only: only });
    if (error || !Array.isArray(data)) throw new Error('list failed');
    return data as Recipient[];
  },
  claim: async (id, kind) => {
    const { error } = await admin.from('waitlist_emails_sent').insert({ waitlist_id: id, kind });
    if (!error) return true;
    if (error.code === '23505') return false;
    throw new Error('claim failed');
  },
  release: async (id, kind) => {
    const { error } = await admin.from('waitlist_emails_sent').delete().eq('waitlist_id', id).eq('kind', kind);
    if (error) throw new Error('release failed');
  },
  send: (mail) => postResend(fetch, apiKey!, mail),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  log: (message) => console.error(message),
}));
