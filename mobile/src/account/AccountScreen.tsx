import { useState } from 'react';
import { ActionSheetIOS, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { SymbolView } from 'expo-symbols';
import { confirmationMatches, confirmationPhrase } from '../../../src/features/account/model.ts';
import { deleteAccountAndSignOut, fetchExport, signOut } from './api';
import { DELETE_ERROR, DELETE_SHEET_MESSAGE, DOWNLOAD_ERROR, LINK_ERROR, SIGN_OUT_ERROR, SIGN_OUT_PROMPT, isShareDismissal, providerLabel } from './copy';
import { shareJsonFile } from './deviceIO';
import { exportDocument } from './exportFile';
import { PRIVACY_URL, TERMS_URL } from './urls';
import { color } from '../theme/tokens';
import { s } from '../theme/styles';
import { Button } from '../ui/Button';

function Notice({ children }: { children: string }) {
  return (
    <View accessibilityRole="alert" style={s.notice}>
      <Text style={s.kicker}>ERROR</Text>
      <Text style={s.noticeText}>{children}</Text>
    </View>
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

/** Who is signed in, sign out, a copy of everything stored, and account deletion. Same steps as the website. */
export function AccountScreen({
  email,
  provider,
  onDeleted,
}: {
  email: string | null;
  provider: string | null;
  onDeleted: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadFailed, setDownloadFailed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);
  const [linkFailed, setLinkFailed] = useState(false);

  const phrase = confirmationPhrase(email);
  const ready = confirmationMatches(typed, email);

  function cancel() {
    setConfirming(false);
    setTyped('');
    setDeleteFailed(false);
  }

  function askToDelete() {
    const openForm = () => setConfirming(true);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          message: DELETE_SHEET_MESSAGE,
          options: ['Delete account', 'Cancel'],
          destructiveButtonIndex: 0,
          cancelButtonIndex: 1,
        },
        (index) => {
          if (index === 0) openForm();
        },
      );
      return;
    }
    Alert.alert('Delete account', DELETE_SHEET_MESSAGE, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete account', style: 'destructive', onPress: openForm },
    ]);
  }

  function askToSignOut() {
    Alert.alert(SIGN_OUT_PROMPT, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', onPress: () => void endSession() },
    ]);
  }

  async function download() {
    setDownloading(true);
    setDownloadFailed(false);
    try {
      const data = await fetchExport();
      const at = new Date();
      const file = exportDocument({ email, exportedAt: at, ...data });
      await shareJsonFile(file.name, file.body);
    } catch (e) {
      if (!isShareDismissal(e)) setDownloadFailed(true);
    } finally {
      setDownloading(false);
    }
  }

  async function remove() {
    if (!ready || deleting) return;
    setDeleting(true);
    setDeleteFailed(false);
    try {
      await deleteAccountAndSignOut();
    } catch {
      setDeleteFailed(true);
      setDeleting(false);
      return;
    }
    onDeleted();
  }

  async function endSession() {
    setSigningOut(true);
    setSignOutFailed(false);
    try {
      await signOut();
    } catch {
      setSignOutFailed(true);
      setSigningOut(false);
    }
  }

  async function open(url: string) {
    setLinkFailed(false);
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      setLinkFailed(true);
    }
  }

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.flex} contentContainerStyle={s.pageScroll} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled">
        <View style={s.card}>
          <Text style={s.label}>Signed in</Text>
          <Text style={s.body}>{email ?? 'Your account'}</Text>
          <Text style={s.hint}>Signed in with {providerLabel(provider)}.</Text>
          {signOutFailed && <Notice>{SIGN_OUT_ERROR}</Notice>}
          <Button label="Sign out" tone="quiet" onPress={askToSignOut} busy={signingOut} />
        </View>

        <View style={s.card}>
          <Text style={s.label}>Your data</Text>
          <Text style={s.body}>
            Download everything you have stored in Intus as one file: daily logs, habits, goals and profile, bloodwork with the ranges from your reports, supplements, sleep, heart readings and screening history. It is yours to keep or take elsewhere.
          </Text>
          {downloadFailed && <Notice>{DOWNLOAD_ERROR}</Notice>}
          <Button label="Download my data" tone="quiet" onPress={() => void download()} busy={downloading} />
        </View>

        <View style={s.card}>
          <Text style={s.label}>Delete account</Text>
          {!confirming ? (
            <Pressable accessibilityRole="button" onPress={askToDelete} style={s.listRow}>
              <Text style={s.destructive}>Delete my account</Text>
            </Pressable>
          ) : (
            <View style={s.row}>
              <Text style={s.body}>
                To confirm, type <Text style={s.phrase}>{phrase}</Text>
              </Text>
              <TextInput
                style={s.input}
                accessibilityLabel={`To confirm, type ${phrase}`}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                keyboardType="email-address"
                textContentType="none"
                spellCheck={false}
                value={typed}
                editable={!deleting}
                onChangeText={setTyped}
                onSubmitEditing={() => void remove()}
              />
              {deleteFailed && <Notice>{DELETE_ERROR}</Notice>}
              <Button label="Cancel" tone="quiet" onPress={cancel} disabled={deleting} />
              <Button
                label={deleting ? 'Deleting…' : 'Delete everything permanently'}
                tone="red"
                onPress={() => void remove()}
                busy={deleting}
                disabled={!ready}
              />
            </View>
          )}
        </View>

        <View style={s.card}>
          <LinkRow label="Privacy policy" onPress={() => void open(PRIVACY_URL)} />
          <LinkRow label="Terms of use" onPress={() => void open(TERMS_URL)} />
          {linkFailed && <Notice>{LINK_ERROR}</Notice>}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
