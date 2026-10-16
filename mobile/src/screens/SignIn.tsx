import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { validateCredentials } from '../../../src/features/auth/credentials.ts';
import { useAuth } from '../auth/AuthContext';
import { colors, fonts, radius } from '../theme/tokens';
import { Notice, PrimaryButton, TextButton } from '../ui/kit';

// Accounts are made on intus.fit; the phone only signs in.
export default function SignIn() {
  const { signIn, sendReset } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'red' | 'ink' } | null>(null);

  async function submit() {
    const errors = validateCredentials('sign-in', { email, password, confirm: '' });
    const first = errors.email ?? errors.password;
    if (first) return setMessage({ text: first, tone: 'red' });
    setBusy(true);
    setMessage(null);
    const failure = await signIn(email, password);
    setBusy(false);
    if (failure) setMessage({ text: failure, tone: 'red' });
  }

  async function forgot() {
    const errors = validateCredentials('sign-in', { email, password: 'x', confirm: '' });
    if (errors.email) return setMessage({ text: errors.email, tone: 'red' });
    setBusy(true);
    const failure = await sendReset(email);
    setBusy(false);
    setMessage(
      failure
        ? { text: failure, tone: 'red' }
        : { text: 'If that email has an account, a reset link is on its way. Finish setting a new password on intus.fit, then sign in here.', tone: 'ink' },
    );
  }

  return (
    <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={s.wordmark}>
          Intus
        </Text>
        <Text style={s.lede}>Sign in to log your day.</Text>
        <View style={s.form}>
          <TextInput
            accessibilityLabel="Email"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            inputMode="email"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={colors.ink3}
            selectTextOnFocus
            style={s.input}
            textContentType="username"
            value={email}
          />
          <TextInput
            accessibilityLabel="Password"
            autoCapitalize="none"
            autoComplete="current-password"
            onChangeText={setPassword}
            onSubmitEditing={submit}
            placeholder="Password"
            placeholderTextColor={colors.ink3}
            returnKeyType="go"
            secureTextEntry
            selectTextOnFocus
            style={s.input}
            textContentType="password"
            value={password}
          />
          {message ? <Notice text={message.text} tone={message.tone} /> : null}
          <PrimaryButton title="Sign in" onPress={submit} busy={busy} />
          <TextButton title="Forgot password" onPress={forgot} tone="ink" />
        </View>
        <Text style={s.foot}>No account yet? Create one at intus.fit.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.paper },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 48, gap: 8 },
  wordmark: { fontFamily: fonts.semibold, fontSize: 44, letterSpacing: -1.2, color: colors.ink },
  lede: { fontFamily: fonts.body, fontSize: 17, color: colors.ink3, marginBottom: 20 },
  form: { gap: 12 },
  input: {
    minHeight: 50,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    paddingHorizontal: 16,
    fontFamily: fonts.body,
    fontSize: 17,
    color: colors.ink,
  },
  foot: { fontFamily: fonts.body, fontSize: 13, color: colors.ink3, textAlign: 'center', marginTop: 24 },
});
