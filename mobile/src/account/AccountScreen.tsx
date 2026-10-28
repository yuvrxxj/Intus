import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { confirmationMatches, confirmationPhrase, providerLabel } from '../../../src/features/account/model.ts';
import { CONTACT_EMAIL } from '../../../src/lib/contact.ts';
import { Button, screen } from '../ui';
import { deleteAccountAndSignOut, fetchExport, signOut } from './api';
import { shareJsonFile } from './deviceIO';
import { exportDocument } from './exportFile';
import { PRIVACY_URL, TERMS_URL } from './urls';

/** Who is signed in, sign out, a copy of everything stored, and account deletion. Same steps as the website. */
export function AccountScreen({
  email,
  provider,
  onBack,
  onDeleted,
}: {
  email: string | null;
  provider: string | null;
  onBack: () => void;
  onDeleted: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  const phrase = confirmationPhrase(email);
  const ready = confirmationMatches(typed, email);

  function cancel() {
    setConfirming(false);
    setTyped('');
    setDeleteError(null);
  }

  async function download() {
    setDownloading(true);
    setDownloadError(null);
    try {
      const data = await fetchExport();
      const at = new Date();
      const file = exportDocument({ email, exportedAt: at, ...data });
      await shareJsonFile(file.name, file.body);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (!/cancel|dismiss/i.test(message)) setDownloadError(message);
    } finally {
      setDownloading(false);
    }
  }

  async function remove() {
    if (!ready || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccountAndSignOut();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : String(e));
      setDeleting(false);
      return;
    }
    onDeleted();
  }

  async function endSession() {
    setSigningOut(true);
    setSignOutError(null);
    try {
      await signOut();
    } catch (e) {
      setSignOutError(e instanceof Error ? e.message : String(e));
      setSigningOut(false);
    }
  }

  async function open(url: string) {
    setLinkError(null);
    try {
      await Linking.openURL(url);
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={screen.scroll} keyboardShouldPersistTaps="handled">
        <Text style={screen.brand}>INTUS</Text>
        <Button label="Back" quiet onPress={onBack} />
        <Text style={screen.title} accessibilityRole="header">Account</Text>

        <View style={screen.card}>
          <Text style={screen.label}>Signed in</Text>
          <Text style={screen.body}>{email ?? 'Your account'}</Text>
          <Text style={screen.hint}>Signed in with {providerLabel(provider)}.</Text>
          {signOutError && <Text style={screen.error} accessibilityRole="alert">{signOutError}</Text>}
          <Button label="Sign out" quiet onPress={() => void endSession()} busy={signingOut} />
        </View>

        <View style={screen.card} accessibilityLabel="Your data">
          <Text style={screen.label}>Your data</Text>
          <Text style={screen.body}>
            Download everything you have stored in Intus as one file: daily logs, habits, goals and profile, bloodwork with the ranges from your reports, supplements, sleep, heart readings and screening history. It is yours to keep or take elsewhere.
          </Text>
          {downloadError && (
            <Text style={screen.error} accessibilityRole="alert">The download could not be made: {downloadError}</Text>
          )}
          <Button label={downloading ? 'Gathering your data…' : 'Download my data'} quiet onPress={() => void download()} busy={downloading} />
        </View>

        <View style={screen.card}>
          <Text style={screen.label}>Delete account</Text>
          <Text style={screen.body}>
            Deleting your account removes your sign-in and everything you have saved in Intus: your daily logs, habits, goals, bloodwork, uploaded reports, supplements, sleep, screening history, profile and photo check-ins. Your photos and reports are deleted first; if any cannot be, nothing else is touched. It happens straight away and cannot be undone. What this phone has kept for the account is removed too.
          </Text>
          {!confirming ? (
            <Button label="Delete my account" danger onPress={() => setConfirming(true)} />
          ) : (
            <View style={screen.row}>
              <Text style={screen.body}>
                To confirm, type <Text style={screen.phrase}>{phrase}</Text>
              </Text>
              <TextInput
                style={screen.input}
                accessibilityLabel={`To confirm, type ${phrase}`}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                spellCheck={false}
                value={typed}
                editable={!deleting}
                onChangeText={setTyped}
                onSubmitEditing={() => void remove()}
              />
              {deleteError && (
                <Text style={screen.error} accessibilityRole="alert">
                  Your account was not deleted. Try again, and email {CONTACT_EMAIL} if it keeps failing.
                  {'\n'}
                  <Text style={screen.detail}>{deleteError}</Text>
                </Text>
              )}
              <Button label={deleting ? 'Deleting' : 'Delete everything permanently'} danger onPress={() => void remove()} busy={deleting} disabled={!ready} />
              <Button label="Cancel" quiet onPress={cancel} disabled={deleting} />
            </View>
          )}
        </View>

        <View style={screen.card}>
          <Text style={screen.label}>Privacy and terms</Text>
          <Pressable accessibilityRole="link" accessibilityLabel="Privacy policy" accessibilityHint={PRIVACY_URL} onPress={() => void open(PRIVACY_URL)} style={screen.linkHit}>
            <Text style={screen.link}>Privacy policy</Text>
          </Pressable>
          <Pressable accessibilityRole="link" accessibilityLabel="Terms of use" accessibilityHint={TERMS_URL} onPress={() => void open(TERMS_URL)} style={screen.linkHit}>
            <Text style={screen.link}>Terms of use</Text>
          </Pressable>
          {linkError && <Text style={screen.error} accessibilityRole="alert">{linkError}</Text>}
        </View>

        <Text style={screen.footer}>Not medical advice. Ranges are flagged, never diagnosed.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
