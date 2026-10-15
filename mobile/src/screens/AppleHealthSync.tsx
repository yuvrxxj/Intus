import type { Session } from '@supabase/supabase-js';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { askToRead, available } from '../healthkit';
import { supabase } from '../supabase';
import { lastSync, syncNow, type SyncResult } from '../sync/run';

// The thin sync companion: sign in, allow Apple Health, and see what was synced. Everything else stays on the web
// app until the screens are built. Colours and type follow the web design tokens (src/styles/index.css).
const C = { paper: '#E5ECE9', surface: '#F2F5F3', ink: '#1F1300', ink3: '#5A5446', red: '#A31621', line: 'rgba(31,19,0,0.12)' };

function Button({ label, onPress, busy, quiet }: { label: string; onPress: () => void; busy?: boolean; quiet?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={busy} style={[s.button, quiet && s.buttonQuiet, busy && { opacity: 0.6 }]}>
      {busy ? <ActivityIndicator color={quiet ? C.ink : C.paper} /> : <Text style={[s.buttonText, quiet && { color: C.ink }]}>{label}</Text>}
    </Pressable>
  );
}

function SignIn() {
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
      <Text style={s.body}>Use the same email and password as on intus.fit. New accounts are made on the website.</Text>
      <TextInput style={s.input} placeholder="Email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={s.input} placeholder="Password" secureTextEntry autoComplete="password" value={password} onChangeText={setPassword} />
      {error && <Text style={s.error} accessibilityRole="alert">{error}</Text>}
      <Button label="Sign in" onPress={submit} busy={busy} />
    </View>
  );
}

function Sync({ session }: { session: Session }) {
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

  if (!available()) {
    return (
      <View style={s.card}>
        <Text style={s.title}>Apple Health is not available</Text>
        <Text style={s.body}>This device has no Health data store (an iPad without Health, for example). Use an iPhone.</Text>
      </View>
    );
  }

  return (
    <>
      <View style={s.card}>
        <Text style={s.label}>Signed in</Text>
        <Text style={s.body}>{session.user.email}</Text>
      </View>

      {!asked ? (
        <View style={s.card}>
          <Text style={s.title}>Connect Apple Health</Text>
          <Text style={s.body}>
            Intus reads your sleep, heart rate variability and resting heart rate, and nothing else. It never writes to Apple Health.
            Everything goes to your own Intus account, which only you can see.
          </Text>
          <Button label="Allow access" onPress={connect} />
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
          <Button label="Sync now" onPress={run} busy={busy} />
        </View>
      )}

      {error && <Text style={s.error} accessibilityRole="alert">{error}</Text>}
      <Button label="Sign out" quiet onPress={() => void supabase.auth.signOut()} />
    </>
  );
}

export default function AppleHealthSync() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <SafeAreaView style={s.screen}>
      <StatusBar style="dark" />
      <View style={s.wrap}>
        <Text style={s.brand}>INTUS</Text>
        {session === undefined ? <ActivityIndicator color={C.red} /> : session ? <Sync session={session} /> : <SignIn />}
        <Text style={s.footer}>Not medical advice. Ranges are flagged, never diagnosed.</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  wrap: { flex: 1, padding: 20, gap: 14 },
  brand: { fontFamily: 'Menlo', fontSize: 12, letterSpacing: 2, color: C.red, marginTop: 8, marginBottom: 6 },
  card: { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 18, gap: 10 },
  title: { fontSize: 22, fontWeight: '700', color: C.ink, letterSpacing: -0.4 },
  label: { fontFamily: 'Menlo', fontSize: 11, letterSpacing: 1, color: C.ink3, textTransform: 'uppercase' },
  body: { fontSize: 15, lineHeight: 21, color: C.ink, fontWeight: '500' },
  hint: { fontSize: 13, lineHeight: 18, color: C.ink3 },
  input: { borderWidth: 1, borderColor: 'rgba(31,19,0,0.22)', borderRadius: 10, padding: 12, fontSize: 16, color: C.ink, backgroundColor: '#FBFCFB' },
  button: { backgroundColor: C.red, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  buttonQuiet: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.line },
  buttonText: { color: C.paper, fontSize: 16, fontWeight: '700' },
  error: { color: C.red, fontSize: 14, fontWeight: '600' },
  footer: { marginTop: 'auto', fontFamily: 'Menlo', fontSize: 10, letterSpacing: 0.6, color: C.ink3, textTransform: 'uppercase', textAlign: 'center' },
});
