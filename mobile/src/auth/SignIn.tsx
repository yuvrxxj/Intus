import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { s } from '../theme/styles';
import { Button } from '../ui/Button';
import { ErrorNotice } from '../ui/ErrorNotice';
import { NEXT } from '../sleep/rules';
import { supabase } from '../supabase';

export function SignIn({ deleted = false }: { deleted?: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit() {
    setBusy(true);
    setFailed(false);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (signInError) setFailed(true);
  }

  return (
    <View style={s.card}>
      <Text style={s.title} accessibilityRole="header">Sign in</Text>
      {deleted ? (
        <Text style={s.body} accessibilityLiveRegion="polite">Your account and everything saved in it have been deleted.</Text>
      ) : null}
      <Text style={s.body}>Use the same email and password as on intus.fit. New accounts are made on the website.</Text>
      <TextInput
        accessibilityLabel="Email"
        style={s.input}
        placeholder="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        accessibilityLabel="Password"
        style={s.input}
        placeholder="Password"
        secureTextEntry
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
      />
      {failed ? <ErrorNotice message={NEXT.signIn} /> : null}
      <Button label="Sign in" tone="red" onPress={() => void submit()} busy={busy} />
    </View>
  );
}
