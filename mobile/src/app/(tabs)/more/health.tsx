import { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, Text } from 'react-native';
import { askToRead, available } from '../../../healthkit';
import { lastSync, syncNow, type SyncResult } from '../../../sync/run';
import { colors, fonts } from '../../../theme/tokens';
import { Group, Notice, PrimaryButton, Row, Screen, TextButton } from '../../../ui/kit';

// Apple Health, read only: sleep, heart rate variability and resting heart rate. Intus never writes to Apple Health.
export default function Health() {
  const [asked, setAsked] = useState(false);
  const [last, setLast] = useState<SyncResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void lastSync().then((r) => {
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
      <Screen>
        <Group label="Apple Health">
          <Row first>
            <Text style={s.body}>This device has no Health data store (an iPad without Health, for example). Use an iPhone.</Text>
          </Row>
        </Group>
      </Screen>
    );
  }

  return (
    <Screen>
      {!asked ? (
        <>
          <Group
            label="Connect Apple Health"
            note="Everything goes to your own Intus account, which only you can see. You can turn access off in Settings, Health, Data Access and Devices."
          >
            <Row first>
              <Text style={s.body}>Intus reads your sleep, heart rate variability and resting heart rate, and nothing else. It never writes to Apple Health.</Text>
            </Row>
          </Group>
          <PrimaryButton title="Allow access" testID="health-allow" onPress={() => void connect()} />
        </>
      ) : (
        <>
          <Group label="Last sync">
            <Row first>
              <Text style={s.body}>
                {last
                  ? `${new Date(last.at).toLocaleString()}: ${last.nights} ${last.nights === 1 ? 'night' : 'nights'} of sleep and ${last.heartDays} ${last.heartDays === 1 ? 'day' : 'days'} of heart readings.${last.skipped > 0 ? ` ${last.skipped} too short or too long to be a real sleep were left out.` : ''}`
                  : 'Nothing synced yet. The first sync reads the last 90 days.'}
              </Text>
            </Row>
          </Group>
          {last && last.nights === 0 && last.heartDays === 0 ? (
            <Notice text="Nothing came back. If you turned access off, iOS does not tell apps: open Settings, Health, Data Access and Devices, Intus, and turn the three on." />
          ) : null}
          <PrimaryButton title="Sync now" testID="health-sync" onPress={() => void run()} busy={busy} />
          <TextButton title="Open Health settings" tone="ink" onPress={() => void Linking.openSettings()} />
        </>
      )}
      {error ? <Notice tone="red" text={error} /> : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.ink, flex: 1 },
});
