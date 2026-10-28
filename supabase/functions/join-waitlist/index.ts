// Supabase Edge Function: join the waitlist, or confirm a link. Deployed by hand, and not deployed with this change.
// See supabase/README.md. Sign-in is not required, so deploy with --no-verify-jwt: the publishable key is not a JWT
// the gateway can check. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
//
// TODO(INT-94 follow-up): send the confirmation email with Resend. Do not send it from here.
// Subject: Confirm your place on the Intus waitlist
// Body: Tap to confirm, then the link https://intus.fit/waitlist/confirmed?token=… (works for 7 days).
// If this was not you, ignore this email and nothing happens.
// Then: We'll email you three times: to confirm, when your place is ready, and when the app ships for your device. Nothing else.
// Then an unsubscribe link. Only status = confirmed is eligible for an invite.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { createHandler, createJoinLimiter, clientIpFrom, productionToken, type StoredWaitlist } from './handler.ts';
import type { Device } from '../../../src/features/home/waitlist.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const limiter = createJoinLimiter();

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
  allowJoin: (ip, now) => limiter.allow(ip, now),
  clientIp: clientIpFrom,
  newToken: productionToken,
  log: (message) => console.error(message),
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
    });
    if (!error) return 'created';
    if (error.code === '23505') return 'exists';
    throw new Error('insert failed');
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
