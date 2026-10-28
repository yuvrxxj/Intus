import type { Session } from '@supabase/supabase-js';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, Text, TextInput, View } from 'react-native';
import { AccountScreen } from './src/account/AccountScreen';
import { askToRead, available } from './src/healthkit';
import { supabase } from './src/supabase';
import { lastSync, syncNow, type SyncResult } from './src/sync/run';
import { C } from './src/theme/tokens';
import { Button, screen as s } from './src/ui';

// Sign in, allow Apple Health, and see what was synced. Account (sign out, download, delete) is its own screen.
function SignIn({ deleted }: { deleted: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (e) setError(e.message);
  }

  return (
    <View style={s.card}>
      <Text style={s.title}>Sign in</Text>
      {deleted && (
        <Text style={s.body} accessibilityLiveRegion="polite">Your account and everything saved in it have been deleted.</Text>
      )}
      <Text style={s.body}>Use the same email and password as on intus.fit. New accounts are made on the website.</Text>
      <TextInput style={s.input} placeholder="Email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={s.input} placeholder="Password" secureTextEntry autoComplete="password" value={password} onChangeText={setPassword} />
      {error && <Text style={s.error} accessibilityRole="alert">{error}</Text>}
      <Button label="Sign in" onPress={() => void submit()} busy={busy} />
    </View>
  );
}

function Sync({ session, onAccount }: { session: Session; onAccount: () => void }) {
  const [asked, setAsked] = useState(false);
  const [last, setLast] = useState<SyncResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    lastSync().then((r) => {
      setLast(r);
      // a sync has happened before, so permission was already asked
      if (r) setAsked(true);
    });
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    try {
      await askToRead();
      setAsked(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setLast(await syncNow());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <>
      <View style={s.card}>
        <Text style={s.label}>Signed in</Text>
        <Text style={s.body}>{session.user.email}</Text>
      </View>

      {!available() ? (
        <View style={s.card}>
          <Text style={s.title}>Apple Health is not available</Text>
          <Text style={s.body}>This device has no Health data store (an iPad without Health, for example). Use an iPhone.</Text>
        </View>
      ) : !asked ? (
        <View style={s.card}>
          <Text style={s.title}>Connect Apple Health</Text>
          <Text style={s.body}>
            Intus reads your sleep, heart rate variability and resting heart rate, and nothing else. It never writes to Apple Health.
            Everything goes to your own Intus account, which only you can see.
          </Text>
          <Button label="Allow access" onPress={() => void connect()} />
        </View>
      ) : (
        <View style={s.card}>
          <Text style={s.title}>Sync</Text>
          {last ? (
            <Text style={s.body}>
              Last synced {new Date(last.at).toLocaleString()}: {last.nights} {last.nights === 1 ? 'night' : 'nights'} of sleep and {last.heartDays} {last.heartDays === 1 ? 'day' : 'days'} of heart readings.
              {last.skipped > 0 ? ` ${last.skipped} too short or too long to be a real sleep were left out.` : ''}
            </Text>
          ) : (
            <Text style={s.body}>Nothing synced yet. The first sync reads the last 90 days.</Text>
          )}
          {last && last.nights === 0 && last.heartDays === 0 && (
            <Text style={s.hint}>
              Nothing came back. If you turned access off, iOS does not tell apps: open Settings, Health, Data Access and Devices, Intus, and turn the three on.
            </Text>
          )}
          <Button label="Sync now" onPress={() => void run()} busy={busy} />
        </View>
      )}

      {error && <Text style={s.error} accessibilityRole="alert">{error}</Text>}
      <Button label="Account" quiet={available()} onPress={onAccount} />
    </>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [where, setWhere] = useState<'sync' | 'account'>('sync');
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) setDeleted(false);
    if (!session) setWhere('sync');
  }, [session]);

  const provider = (session?.user.app_metadata?.provider as string | undefined) ?? null;

  return (
    <SafeAreaView style={s.screen}>
      <StatusBar style="dark" />
      {session && where === 'account' ? (
        <AccountScreen
          email={session.user.email ?? null}
          provider={provider}
          onBack={() => setWhere('sync')}
          onDeleted={() => {
            setDeleted(true);
            setSession(null);
          }}
        />
      ) : (
        <View style={s.wrap}>
          <Text style={s.brand}>INTUS</Text>
          {session === undefined ? (
            <ActivityIndicator color={C.red} />
          ) : session ? (
            <Sync session={session} onAccount={() => setWhere('account')} />
          ) : (
            <SignIn deleted={deleted} />
          )}
          <Text style={s.footer}>Not medical advice. Ranges are flagged, never diagnosed.</Text>
        </View>
      )}
    </SafeAreaView>
  );
}
