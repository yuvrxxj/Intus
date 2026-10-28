// Supabase Edge Function: join the waitlist, or confirm a link. Deployed by hand, and not deployed with this change.
// See supabase/README.md. Sign-in is not required, so deploy with --no-verify-jwt: the publishable key is not a JWT
// the gateway can check. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
//
// TODO(INT-94 follow-up): send the confirmation email (Resend). This function only stores a hash of the token.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { createHandler, createJoinLimiter, clientIpFrom, productionToken, type StoredWaitlist } from './handler.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const limiter = createJoinLimiter();

interface Row {
  id: string;
  status: 'pending' | 'confirmed';
  confirm_token_hash: string | null;
  confirm_token_expires_at: string | null;
}

function mapRow(row: Row): StoredWaitlist {
  return {
    id: row.id,
    status: row.status,
    confirmTokenHash: row.confirm_token_hash,
    confirmTokenExpiresAt: row.confirm_token_expires_at,
  };
}

Deno.serve(createHandler({
  now: () => Date.now(),
  allowJoin: (ip, now) => limiter.allow(ip, now),
  clientIp: clientIpFrom,
  newToken: productionToken,
  log: (message) => console.error(message),
  findByEmail: async (email) => {
    const { data, error } = await admin.from('waitlist').select('id, status, confirm_token_hash, confirm_token_expires_at').eq('email', email).maybeSingle();
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
    });
    if (!error) return 'created';
    if (error.code === '23505') return 'exists';
    throw new Error('insert failed');
  },
  replaceToken: async (id, hash, expiresAt, device) => {
    const { error } = await admin.from('waitlist').update({
      confirm_token_hash: hash,
      confirm_token_expires_at: expiresAt,
      device,
    }).eq('id', id).eq('status', 'pending');
    if (error) throw new Error('replace failed');
  },
  findByTokenHash: async (hash) => {
    const { data, error } = await admin.from('waitlist').select('id, status, confirm_token_hash, confirm_token_expires_at').eq('confirm_token_hash', hash).maybeSingle();
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
}));
