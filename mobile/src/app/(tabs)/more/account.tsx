import { Directory, File, Paths } from 'expo-file-system';
import { useState } from 'react';
import { Linking, Share, StyleSheet, Text, TextInput } from 'react-native';
import { confirmationMatches, confirmationPhrase, providerLabel } from '../../../../../src/features/account/model.ts';
import { useAuth } from '../../../auth/AuthContext';
import { buildMyExport, deleteMyAccount } from '../../../data/account';
import { clearDeviceData } from '../../../data/storage';
import { colors, fonts, radius } from '../../../theme/tokens';
import { Group, Notice, PrimaryButton, Row, Screen, TextButton } from '../../../ui/kit';

const SITE = 'https://intus.fit';

export default function Account() {
  const { session, signOut } = useAuth();
  const email = session?.user.email ?? null;
  const provider = (session?.user.app_metadata?.provider as string | undefined) ?? null;

  const [exporting, setExporting] = useState(false);
  const [exportFailure, setExportFailure] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteFailure, setDeleteFailure] = useState<string | null>(null);

  async function download() {
    setExporting(true);
    setExportFailure(null);
    try {
      const { name, json } = await buildMyExport(email);
      const file = new File(Paths.cache, name);
      if (file.exists) file.delete();
      file.create();
      file.write(json);
      // the system share sheet: Save to Files, AirDrop, Mail. Nothing leaves the phone except by the person's choice.
      await Share.share({ url: file.uri });
    } catch (e) {
      setExportFailure(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  }

  async function remove() {
    if (!confirmationMatches(typed, email) || deleting) return;
    setDeleting(true);
    setDeleteFailure(null);
    try {
      await deleteMyAccount();
    } catch (e) {
      setDeleteFailure(e instanceof Error ? e.message : String(e));
      setDeleting(false);
      return;
    }
    // everything is gone from the database: clear this phone, then drop the session; the gate shows sign-in
    await clearDeviceData().catch(() => undefined);
    await signOut();
  }

  function cancel() {
    setConfirming(false);
    setTyped('');
    setDeleteFailure(null);
  }

  const ready = confirmationMatches(typed, email);

  return (
    <Screen>
      <Group label="Signed in">
        <Row first style={s.who}>
          <Text selectable style={s.email}>
            {email ?? 'Your account'}
          </Text>
          <Text style={s.note}>Signed in with {providerLabel(provider)}.</Text>
        </Row>
      </Group>
      <PrimaryButton title="Sign out" testID="sign-out" onPress={() => void signOut()} />

      <Group
        label="Your data"
        note="Everything you have stored in Intus as one file: daily logs, habits, goals and profile, bloodwork, supplements, sleep and heart readings. It is yours to keep or take elsewhere."
      >
        <Row first>
          <TextButton title={exporting ? 'Gathering your data…' : 'Download my data'} onPress={() => void download()} />
        </Row>
      </Group>
      {exportFailure ? <Notice tone="red" text={`The download could not be made: ${exportFailure}`} /> : null}

      <Group label="Legal">
        <Row first>
          <TextButton title="Privacy policy" onPress={() => void Linking.openURL(`${SITE}/privacy`)} />
        </Row>
        <Row>
          <TextButton title="Terms" onPress={() => void Linking.openURL(`${SITE}/terms`)} />
        </Row>
      </Group>

      <Group
        label="Delete account"
        note="Deleting removes your sign-in and everything you have saved in Intus: daily logs, habits, goals, bloodwork, uploaded reports, supplements, sleep, profile and photo check-ins. Your photos and reports go first; if any cannot be removed, nothing else is touched. It happens straight away and cannot be undone."
      >
        {!confirming ? (
          <Row first>
            <TextButton title="Delete my account" testID="delete-start" onPress={() => setConfirming(true)} />
          </Row>
        ) : (
          <Row first style={s.confirm}>
            <Text style={s.prompt}>
              To confirm, type <Text style={s.phrase}>{confirmationPhrase(email)}</Text>
            </Text>
            <TextInput
              accessibilityLabel="Type your email to confirm"
              testID="delete-confirm"
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect={false}
              editable={!deleting}
              onChangeText={setTyped}
              placeholder={confirmationPhrase(email)}
              placeholderTextColor={colors.ink3}
              style={s.input}
              value={typed}
            />
          </Row>
        )}
      </Group>
      {confirming ? (
        <>
          {deleteFailure ? <Notice tone="red" text={`Your account was not deleted. Try again, and write to us if it keeps failing. ${deleteFailure}`} /> : null}
          <PrimaryButton title="Delete everything permanently" testID="delete-go" onPress={() => void remove()} disabled={!ready} busy={deleting} />
          <TextButton title="Cancel" onPress={cancel} tone="ink" />
        </>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  who: { flexDirection: 'column', alignItems: 'flex-start', gap: 2 },
  email: { fontFamily: fonts.medium, fontSize: 17, color: colors.ink },
  note: { fontFamily: fonts.body, fontSize: 13, color: colors.ink3 },
  confirm: { flexDirection: 'column', alignItems: 'stretch', gap: 8 },
  prompt: { fontFamily: fonts.body, fontSize: 15, color: colors.ink },
  phrase: { fontFamily: fonts.mono, color: colors.ink },
  input: {
    minHeight: 44,
    borderRadius: radius.control,
    backgroundColor: colors.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    paddingHorizontal: 12,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
  },
});
