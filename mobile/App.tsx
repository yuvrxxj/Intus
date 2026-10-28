import type { Session } from '@supabase/supabase-js';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from './src/supabase';
import { SignedIn } from './src/nav/SignedIn';
import { useIntusFonts } from './src/theme/fonts';
import { s } from './src/theme/styles';
import { color } from './src/theme/tokens';
import { Button } from './src/ui/Button';

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
      {error && <Text style={s.hint} accessibilityRole="alert">{error}</Text>}
      <Button label="Sign in" tone="red" onPress={() => void submit()} busy={busy} />
    </View>
  );
}

export default function App() {
  const fonts = useIntusFonts();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) setDeleted(false);
  }, [session]);

  const waiting = !fonts.ready || session === undefined;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {waiting ? (
        <SafeAreaView style={s.screen}>
          <View style={s.center}>
            <ActivityIndicator color={color.ink} />
          </View>
        </SafeAreaView>
      ) : session ? (
        <SignedIn
          session={session}
          onDeleted={() => {
            setDeleted(true);
            setSession(null);
          }}
        />
      ) : (
        <SafeAreaView style={s.screen}>
          <View style={s.wrap}>
            <Text style={s.brand}>INTUS</Text>
            <SignIn deleted={deleted} />
          </View>
        </SafeAreaView>
      )}
    </SafeAreaProvider>
  );
}
