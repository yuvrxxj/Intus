import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { s } from '../theme/styles';
import { Button } from '../ui/Button';
import { supabase } from '../supabase';

export function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (signInError) setError(signInError.message);
  }

  return (
    <View style={s.card}>
      <Text style={s.title} accessibilityRole="header">Sign in</Text>
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
      {error ? <Text style={s.error} accessibilityRole="alert">{error}</Text> : null}
      <Button label="Sign in" tone="red" onPress={() => void submit()} busy={busy} />
    </View>
  );
}
