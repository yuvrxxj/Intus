import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import type { SleepSession, SleepValues } from '../../../src/features/sleep/model.ts';
import { addSleep, deleteSleep, fetchProfileAge, fetchSleepSince } from '../data/sleep';
import { askToRead, available } from '../healthkit';
import { healthAsked, markHealthAsked } from '../health/asked';
import { s } from '../theme/styles';
import { color } from '../theme/tokens';
import { Button } from '../ui/Button';
import { supabase } from '../supabase';
import { lastSync, syncNow, type SyncResult } from '../sync/run';
import { ManualEntry } from './ManualEntry';
import { PermissionSheet } from './PermissionSheet';
import {
  SLEEP_HISTORY_DAYS,
  averageFigures,
  nightLine,
  presentSleep,
  shouldOfferHealthSheet,
  todayKey,
  waitingCopy,
  type NightLine,
  type SleepPresentation,
} from './rules';

const PAGE = 14;
const DAY_MS = 86_400_000;

interface Loaded {
  sessions: SleepSession[];
  today: string;
  nowMs: number;
  age: number | null;
  view: SleepPresentation;
}

export function SleepScreen({ session }: { session: Session }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [asked, setAsked] = useState<boolean | null>(null);
  const [last, setLast] = useState<SyncResult | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [busyId, setBusyId] = useState<string | null>(null);
  const healthOn = available();
  const request = useRef(0);

  const load = useCallback(async (initial: boolean) => {
    const id = ++request.current;
    if (initial) setStatus('loading');
    const now = new Date();
    const today = todayKey(now);
    const nowMs = now.getTime();
    try {
      const sessions = await fetchSleepSince(nowMs - SLEEP_HISTORY_DAYS * DAY_MS);
      let age: number | null = null;
      try {
        age = await fetchProfileAge(today);
      } catch {
        age = null;
      }
      if (request.current !== id) return;
      setLoaded({ sessions, today, nowMs, age, view: presentSleep(sessions, today, nowMs, age, healthOn) });
      setLoadError(null);
      setStatus('ready');
    } catch (e) {
      if (request.current !== id) return;
      const message = e instanceof Error ? e.message : String(e);
      if (initial) {
        setStatus('error');
        setLoadError(message);
      } else {
        setLoadError(message);
      }
    }
  }, [healthOn]);

  useEffect(() => {
    void load(true);
    let live = true;
    void healthAsked().then((value) => {
      if (live) setAsked(value);
    });
    void lastSync().then((value) => {
      if (live) setLast((current) => current ?? value);
    });
    return () => {
      live = false;
    };
  }, [load]);

  const reload = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(false);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const runSync = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      await askToRead();
      await markHealthAsked();
      setAsked(true);
      setLast(await syncNow());
      await load(false);
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  }, [load]);

  const skipSheet = useCallback(async () => {
    try {
      await markHealthAsked();
      setAsked(true);
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  async function save(values: SleepValues) {
    await addSleep(values);
    await load(false);
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      await deleteSleep(id);
      await load(false);
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  const sheet = status !== 'error' && asked !== null && shouldOfferHealthSheet(healthOn, asked);
  const view = loaded?.view;
  const accent = !sheet && status === 'ready';
  const manualIsRed = accent && (view?.showManual ?? false);
  const syncIsRed = accent && !(view?.showManual ?? true);

  return (
    <>
      <ScrollView
        style={s.flex}
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void reload()} tintColor={color.ink} />}
      >
        <Text style={s.largeTitle} accessibilityRole="header">Sleep</Text>
        <Text style={s.hint}>{session.user.email}</Text>

        {status === 'loading' ? <ActivityIndicator color={color.ink} /> : null}
        {status === 'error' ? (
          <View style={s.card}>
            <Text style={s.title}>Your sleep could not be loaded</Text>
            <Text style={s.error} accessibilityRole="alert">{loadError}</Text>
            <Button label="Try again" tone={sheet ? 'quiet' : 'red'} onPress={() => void load(true)} />
          </View>
        ) : null}

        {status === 'ready' && view && loaded ? (
          <>
            <Summary view={view} />
            {loadError ? <Text style={s.error} accessibilityRole="alert">{loadError}</Text> : null}
            {view.nights.length > 0 ? (
              <View style={s.card}>
                <Text style={s.label}>Nights</Text>
                <Text style={s.hint}>One source is used for each night. Another source is listed beside it and is not added in.</Text>
                {view.nights.slice(0, shown).map((night, index) => (
                  <NightRow
                    key={`${night.key}-${night.main.session.id}`}
                    line={nightLine(night, view.band)}
                    first={index === 0}
                    busy={busyId === night.main.session.members[0]}
                    onDelete={(id) => void remove(id)}
                  />
                ))}
                {view.nights.length > shown ? (
                  <Button label="Show earlier nights" tone="quiet" onPress={() => setShown((count) => count + PAGE)} />
                ) : null}
              </View>
            ) : null}
            {view.showManual ? (
              <ManualEntry
                key={loaded.sessions.filter((item) => item.sourceKind === 'manual').length}
                today={loaded.today}
                nowMs={loaded.nowMs}
                existing={loaded.sessions}
                accent={manualIsRed}
                onSave={save}
              />
            ) : null}
            <HealthCard
              healthOn={healthOn}
              last={last}
              busy={syncing}
              tone={syncIsRed ? 'red' : 'quiet'}
              onSync={() => void runSync()}
            />
            {view.quarantined.length > 0 ? (
              <View style={s.card}>
                <Text style={s.label}>Set aside</Text>
                <Text style={s.hint}>These records were not used, because the numbers in them cannot be right.</Text>
                {view.quarantined.map((item) => (
                  <Text key={`${item.when}-${item.reason}`} style={s.meta}>{item.when}: {item.reason}</Text>
                ))}
              </View>
            ) : null}
          </>
        ) : null}

        {syncError && !sheet ? <Text style={s.error} accessibilityRole="alert">{syncError}</Text> : null}
        <Button label="Sign out" tone="quiet" onPress={() => void supabase.auth.signOut()} />
      </ScrollView>
      <PermissionSheet visible={sheet} busy={syncing} error={sheet ? syncError : null} onContinue={() => void runSync()} onNotNow={() => void skipSheet()} />
    </>
  );
}

function Summary({ view }: { view: SleepPresentation }) {
  const figures = view.showAverages ? averageFigures(view.summary, view.band) : null;
  return (
    <View style={s.card}>
      <Text style={s.label}>Last {view.summary.windowDays} days</Text>
      {figures ? (
        <>
          <View style={s.stats}>
            <Stat label="Time asleep" value={figures.asleep} note={figures.asleepNote} />
            {figures.fellAsleep ? <Stat label="Usually asleep" value={figures.fellAsleep} note={figures.fellAsleepNote ?? undefined} /> : null}
            {figures.woke ? <Stat label="Usually up" value={figures.woke} note={figures.wokeNote ?? undefined} /> : null}
            <Stat label="Nights" value={figures.nights} note="with a record" />
          </View>
          <Text style={s.hint}>{figures.footnote}</Text>
        </>
      ) : (
        <Text style={s.body}>{waitingCopy(view.summary)}</Text>
      )}
    </View>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.number}>{value}</Text>
      {note ? <Text style={s.hint}>{note}</Text> : null}
    </View>
  );
}

function NightRow({
  line,
  first,
  busy,
  onDelete,
}: {
  line: NightLine;
  first: boolean;
  busy: boolean;
  onDelete: (id: string) => void;
}) {
  const [asking, setAsking] = useState(false);
  return (
    <View style={[s.night, first && s.nightFirst]}>
      <View style={s.nightTop}>
        <Text style={s.body}>{line.heading}</Text>
        <Text style={s.nightDuration}>{line.duration}</Text>
      </View>
      <Text style={s.meta}>{line.basis}</Text>
      <Text style={s.meta}>{line.when} · {line.source}{line.joined ? ` · ${line.joined}` : ''}</Text>
      {line.range ? <Text style={s.hint}>{line.range}</Text> : null}
      {line.detail ? <Text style={s.hint}>{line.detail}</Text> : null}
      {line.stages ? <Text style={s.hint}>{line.stages}</Text> : null}
      {line.extras.map((extra) => <Text key={extra} style={s.meta}>{extra}</Text>)}
      {line.alternatives.map((alt) => <Text key={alt} style={s.hint}>{alt}</Text>)}
      {line.flags.map((flag) => <Text key={flag} style={s.hint}>{flag}</Text>)}
      {line.editable ? (
        asking ? (
          <View style={s.row}>
            <View style={s.field}>
              <Button label="Delete for good" tone="quiet" busy={busy} onPress={() => onDelete(line.deleteId)} />
            </View>
            <View style={s.field}>
              <Button label="Keep" tone="quiet" onPress={() => setAsking(false)} />
            </View>
          </View>
        ) : (
          <Button label="Delete" tone="quiet" onPress={() => setAsking(true)} accessibilityLabel={`Delete ${line.heading}`} />
        )
      ) : null}
    </View>
  );
}

function HealthCard({
  healthOn,
  last,
  busy,
  tone,
  onSync,
}: {
  healthOn: boolean;
  last: SyncResult | null;
  busy: boolean;
  tone: 'red' | 'quiet';
  onSync: () => void;
}) {
  if (!healthOn) {
    return (
      <View style={s.card}>
        <Text style={s.label}>Apple Health</Text>
        <Text style={s.body}>This device has no Health data store. Enter nights by hand.</Text>
      </View>
    );
  }
  const empty = last !== null && last.nights === 0 && last.heartDays === 0;
  return (
    <View style={s.card}>
      <Text style={s.label}>Apple Health</Text>
      {last ? (
        <Text style={s.body}>
          Last synced {new Date(last.at).toLocaleString()}: {last.nights} {last.nights === 1 ? 'night' : 'nights'} of sleep and {last.heartDays} {last.heartDays === 1 ? 'day' : 'days'} of heart readings.
          {last.skipped > 0 ? ` ${last.skipped} too short or too long to be a real sleep were left out.` : ''}
        </Text>
      ) : (
        <Text style={s.body}>Nothing synced yet. The first sync reads the last 90 days. Later syncs re-read the last 3 days.</Text>
      )}
      {empty ? (
        <Text style={s.hint}>
          Nothing came back. If you turned access off, iOS does not tell apps: open Settings, Health, Data Access and Devices, Intus, and turn the three on.
        </Text>
      ) : null}
      <Button label="Sync now" tone={tone} onPress={onSync} busy={busy} accessibilityLabel="Sync Apple Health now" />
    </View>
  );
}
