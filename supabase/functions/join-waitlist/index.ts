// Supabase Edge Function: join the waitlist, or confirm a link. Deployed by hand, and not deployed with this change.
// See supabase/README.md. Sign-in is not required, so deploy with --no-verify-jwt: the publishable key is not a JWT
// the gateway can check. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
//
// The confirm email goes out through Resend from marketing@mail.intus.fit. Secrets are set in the Supabase dashboard,
// never in code: RESEND_API_KEY. WAITLIST_EMAIL_LIVE=true lets mail go to every sign-up; until then only addresses in
// WAITLIST_EMAIL_ALLOWLIST (comma separated, for test sign-ups) get one. See mailer.ts.
// The "place ready" and "launch" emails are sent by send-waitlist-email. Their unsubscribe link lands here
// (action 'unsubscribe'), checked against the secret WAITLIST_UNSUBSCRIBE_SECRET.
// Only status = confirmed is eligible for an invite.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { createHandler, createJoinLimiter, clientIpFrom, productionToken, type StoredWaitlist } from './handler.ts';
import type { Device } from '../_shared/waitlistRules.ts';
import { createSendConfirm, mailerSettingsFrom } from './mailer.ts';
import { createSharedAllowJoin } from './sharedRateLimit.ts';
import { JOIN_RATE_LIMIT, JOIN_RATE_WINDOW_MS, sha256Hex } from '../_shared/waitlistRules.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

// The join limit is counted in the database so every instance shares it; the in-memory limiter only answers if the
// database call fails. The caller's address is hashed with a server-side secret first and never stored.
const memoryLimiter = createJoinLimiter();
const RATE_SALT = Deno.env.get('WAITLIST_RATE_SALT') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const allowJoin = createSharedAllowJoin({
  hashKey: (ip) => sha256Hex(`${RATE_SALT}:${ip}`),
  check: async (keyHash) => {
    const { data, error } = await admin.rpc('waitlist_allow_join', {
      p_key_hash: keyHash,
      p_limit: JOIN_RATE_LIMIT,
      p_window_seconds: JOIN_RATE_WINDOW_MS / 1000,
    });
    if (error || typeof data !== 'boolean') throw new Error('rate limit check failed');
    return data;
  },
  fallback: memoryLimiter,
  log: (message) => console.error(message),
});
const sendConfirm = createSendConfirm(mailerSettingsFrom((name) => Deno.env.get(name), fetch));

interface Row {
  id: string;
  status: 'pending' | 'confirmed';
  device: Device;
  confirm_token_hash: string | null;
  confirm_token_expires_at: string | null;
  confirm_sent_at: string | null;
  tracks_today: string | null;
  answered_at: string | null;
}

const COLUMNS = 'id, status, device, confirm_token_hash, confirm_token_expires_at, confirm_sent_at, tracks_today, answered_at';

function mapRow(row: Row): StoredWaitlist {
  return {
    id: row.id,
    status: row.status,
    device: row.device,
    confirmTokenHash: row.confirm_token_hash,
    confirmTokenExpiresAt: row.confirm_token_expires_at,
    confirmSentAt: row.confirm_sent_at,
    tracksToday: row.tracks_today,
    answeredAt: row.answered_at,
  };
}

Deno.serve(createHandler({
  now: () => Date.now(),
  allowJoin,
  clientIp: clientIpFrom,
  newToken: productionToken,
  sendConfirm,
  log: (message) => console.error(message),
  unsubscribeSecret: Deno.env.get('WAITLIST_UNSUBSCRIBE_SECRET') || undefined,
  markUnsubscribed: async (id, at) => {
    // Only the first unsubscribe sets the time; a second open of the link writes nothing.
    const { error } = await admin.from('waitlist').update({ unsubscribed_at: at }).eq('id', id).is('unsubscribed_at', null);
    if (error) throw new Error('unsubscribe failed');
  },
  findByEmail: async (email) => {
    const { data, error } = await admin.from('waitlist').select(COLUMNS).eq('email', email).maybeSingle();
    if (error) throw new Error('read failed');
    return data ? mapRow(data as Row) : null;
  },
  insert: async (row) => {
    const { error } = await admin.from('waitlist').insert({
      email: row.email,
      device: row.device,
      status: 'pending',
      confirm_token_hash: row.confirmTokenHash,
      confirm_token_expires_at: row.confirmTokenExpiresAt,
      confirm_sent_at: row.confirmSentAt,
      referred_by: row.referredBy ?? null,
    });
    if (!error) return 'created';
    if (error.code === '23505') return 'exists';
    throw new Error('insert failed');
  },
  findReferrer: async (code) => {
    const { data, error } = await admin.from('waitlist').select('id, email').eq('referral_code', code).eq('status', 'confirmed').maybeSingle();
    if (error) throw new Error('read failed');
    return data ? { id: data.id as string, email: data.email as string } : null;
  },
  standing: async (id) => {
    const { data, error } = await admin.from('waitlist_standing').select('referral_code, place, referrals').eq('id', id).maybeSingle();
    if (error) throw new Error('read failed');
    return data ? { code: data.referral_code as string, place: data.place as number, referrals: data.referrals as number } : null;
  },
  replaceToken: async (id, hash, expiresAt, device, sentAt) => {
    const { error } = await admin.from('waitlist').update({
      confirm_token_hash: hash,
      confirm_token_expires_at: expiresAt,
      confirm_sent_at: sentAt,
      device,
    }).eq('id', id).eq('status', 'pending');
    if (error) throw new Error('replace failed');
  },
  findByTokenHash: async (hash) => {
    const { data, error } = await admin.from('waitlist').select(COLUMNS).eq('confirm_token_hash', hash).maybeSingle();
    if (error) throw new Error('read failed');
    return data ? mapRow(data as Row) : null;
  },
  markConfirmed: async (id, confirmedAt) => {
    const { error } = await admin.from('waitlist').update({
      status: 'confirmed',
      confirmed_at: confirmedAt,
    }).eq('id', id).eq('status', 'pending');
    if (error) throw new Error('confirm failed');
  },
  saveAnswers: async (id, device, tracksToday, answeredAt) => {
    const { error } = await admin.from('waitlist').update({
      device,
      tracks_today: tracksToday,
      answered_at: answeredAt,
    }).eq('id', id).eq('status', 'confirmed');
    if (error) throw new Error('answers failed');
  },
}));
