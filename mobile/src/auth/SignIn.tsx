import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { SymbolView } from 'expo-symbols';
import { PRIVACY_URL, TERMS_URL } from '../account/urls';
import { LINK_ERROR } from '../account/copy';
import { color, font } from '../theme/tokens';
import { s } from '../theme/styles';
import { Button } from '../ui/Button';
import { ErrorNotice } from '../ui/ErrorNotice';
import { supabase } from '../supabase';
import { COPY, checkEmailMessage, checkForm, createAccount, signIn, type AuthMode } from './rules';
import type { CredentialErrors } from '../../../src/features/auth/credentials.ts';

/** A plain text button for the second action on the card, so the red one stays the only red. */
function TextButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.textButton} hitSlop={4}>
      <Text style={styles.textButtonLabel}>{label}</Text>
    </Pressable>
  );
}

function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={s.listRow}>
      <Text style={s.body}>{label}</Text>
      <SymbolView name="arrow.up.right" tintColor={color.ink3} size={16} />
    </Pressable>
  );
}

export function SignIn({ deleted = false }: { deleted?: boolean }) {
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fields, setFields] = useState<CredentialErrors>({});
  const [linkFailed, setLinkFailed] = useState(false);

  const signingUp = mode === 'sign-up';

  function switchMode(next: AuthMode) {
    setMode(next);
    setSentTo(null);
    setPassword('');
    setConfirm('');
    setMessage(null);
    setFields({});
    setLinkFailed(false);
  }

  async function open(url: string) {
    setLinkFailed(false);
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      setLinkFailed(true);
    }
  }

  async function submit() {
    const check = checkForm(mode, { email, password, confirm, agreed });
    setFields(check.fields);
    setMessage(check.message);
    if (check.message) return;
    setBusy(true);
    if (signingUp) {
      const outcome = await createAccount(supabase.auth, email, password);
      setBusy(false);
      if (outcome.kind === 'failed') setMessage(outcome.message);
      else if (outcome.kind === 'check-email') {
        setPassword('');
        setConfirm('');
        setSentTo(outcome.email);
      }
      // 'signed-in': the auth listener in App.tsx swaps this screen out
    } else {
      const failure = await signIn(supabase.auth, email, password);
      setBusy(false);
      if (failure) setMessage(failure);
    }
  }

  if (sentTo) {
    return (
      <View style={s.card}>
        <Text style={s.title} accessibilityRole="header">{COPY.sentTitle}</Text>
        <Text style={s.body} accessibilityLiveRegion="polite">{checkEmailMessage(sentTo)}</Text>
        <Button label={COPY.backToSignIn} tone="red" onPress={() => switchMode('sign-in')} />
      </View>
    );
  }

  return (
    <View style={s.card}>
      <Text style={s.title} accessibilityRole="header">{signingUp ? COPY.signUpTitle : COPY.signInTitle}</Text>
      {deleted ? (
        <Text style={s.body} accessibilityLiveRegion="polite">Your account and everything saved in it have been deleted.</Text>
      ) : null}
      <Text style={s.body}>{signingUp ? COPY.signUpIntro : COPY.signInIntro}</Text>
      <TextInput
        accessibilityLabel="Email"
        style={[s.input, fields.email ? s.inputInvalid : null]}
        placeholder="Email"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType={signingUp ? 'emailAddress' : 'username'}
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        accessibilityLabel="Password"
        style={[s.input, fields.password ? s.inputInvalid : null]}
        placeholder="Password"
        secureTextEntry
        autoCapitalize="none"
        autoComplete={signingUp ? 'new-password' : 'current-password'}
        textContentType={signingUp ? 'newPassword' : 'password'}
        value={password}
        onChangeText={setPassword}
      />
      {signingUp ? (
        <>
          <TextInput
            accessibilityLabel="Password again"
            style={[s.input, fields.confirm ? s.inputInvalid : null]}
            placeholder="Password again"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            value={confirm}
            onChangeText={setConfirm}
          />
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreed }}
            accessibilityLabel={COPY.consent}
            onPress={() => setAgreed((value) => !value)}
            style={styles.consent}
          >
            <SymbolView name={agreed ? 'checkmark.square.fill' : 'square'} tintColor={color.ink} size={22} />
            <Text style={[s.body, styles.consentText]}>{COPY.consent}</Text>
          </Pressable>
          <LinkRow label="Privacy policy" onPress={() => void open(PRIVACY_URL)} />
          <LinkRow label="Terms of use" onPress={() => void open(TERMS_URL)} />
          {linkFailed ? <ErrorNotice message={LINK_ERROR} /> : null}
        </>
      ) : null}
      {message ? <ErrorNotice message={message} /> : null}
      <Button
        label={signingUp ? COPY.signUpTitle : COPY.signInTitle}
        tone="red"
        onPress={() => void submit()}
        busy={busy}
      />
      <TextButton label={signingUp ? COPY.toSignIn : COPY.toSignUp} onPress={() => switchMode(signingUp ? 'sign-in' : 'sign-up')} />
    </View>
  );
}

const styles = StyleSheet.create({
  textButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  textButtonLabel: { fontFamily: font.bold, fontSize: 16, color: color.ink, textDecorationLine: 'underline', textAlign: 'center' },
  consent: { minHeight: 44, flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6 },
  consentText: { flex: 1 },
});
