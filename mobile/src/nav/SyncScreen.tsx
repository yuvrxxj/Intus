import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { askToRead, available } from '../healthkit';
import { lastSync, syncNow, type SyncResult } from '../sync/run';
import { s } from '../theme/styles';
import { Button } from '../ui/Button';

/** Apple Health connect and sync. Account lives on the More tab. */
export function SyncScreen({ session }: { session: Session }) {
  const [asked, setAsked] = useState(false);
  const [last, setLast] = useState<SyncResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    lastSync().then((r) => {
      setLast(r);
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

  return (
    <View style={s.wrap}>
      <Text style={s.brand}>INTUS</Text>
      <View style={s.card}>
        <Text style={s.label}>Signed in</Text>
        <Text style={s.body}>{session.user.email}</Text>
      </View>

      {!available() ? (
        <View style={s.card}>
          <Text style={s.title}>Apple Health is not available</Text>
          <Text style={s.body}>This device has no Health data store (an iPad without Health, for example). Use an iPhone.</Text>
        </View>
      ) : !asked ? (
        <View style={s.card}>
          <Text style={s.title}>Connect Apple Health</Text>
          <Text style={s.body}>
            Intus reads your sleep, heart rate variability and resting heart rate, and nothing else. It never writes to Apple Health.
            Everything goes to your own Intus account, which only you can see.
          </Text>
          <Button label="Allow access" tone="red" onPress={() => void connect()} />
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
          <Button label="Sync now" tone="red" onPress={() => void run()} busy={busy} />
        </View>
      )}

      {error && <Text accessibilityRole="alert" style={s.hint}>{error}</Text>}
    </View>
  );
}
