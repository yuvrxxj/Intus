import { useCallback, useEffect, useRef, useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, Platform, RefreshControl, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import type { SleepSession, SleepValues } from '../../../src/features/sleep/model.ts';
import { addSleep, deleteSleep, fetchProfileAge, fetchSleepSince } from '../data/sleep';
import { askToRead, available } from '../health/provider';
import { healthAsked, markHealthAsked } from '../health/asked';
import { s } from '../theme/styles';
import { color } from '../theme/tokens';
import { Button } from '../ui/Button';
import { ErrorNotice } from '../ui/ErrorNotice';
import { supabase } from '../supabase';
import { lastSync, syncNow, type SyncResult } from '../sync/run';
import { ManualEntry } from './ManualEntry';
import { PermissionSheet } from './PermissionSheet';
import {
  HEALTH_SETTINGS_HINT,
  NEXT,
  SLEEP_HISTORY_DAYS,
  SLOW_LOAD_MS,
  averageFigures,
  nightLine,
  presentSleep,
  shouldOfferHealthSheet,
  showManualEntry,
  stacksForFontScale,
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
  view: SleepPresentation;
}

export function SleepScreen() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refreshProblem, setRefreshProblem] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [asked, setAsked] = useState<boolean | null>(null);
  const [last, setLast] = useState<SyncResult | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncProblem, setSyncProblem] = useState(false);
  const [deleteProblem, setDeleteProblem] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formHeld, setFormHeld] = useState(false);
  const healthOn = available();
  const request = useRef(0);
  const { fontScale } = useWindowDimensions();
  const stacked = stacksForFontScale(fontScale);

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
      setLoaded({ sessions, today, nowMs, view: presentSleep(sessions, today, nowMs, age, healthOn) });
      setRefreshProblem(false);
      setStatus('ready');
    } catch {
      if (request.current !== id) return;
      if (initial) setStatus('error');
      else setRefreshProblem(true);
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
    setSyncProblem(false);
    try {
      await askToRead();
      await markHealthAsked();
      setAsked(true);
      setLast(await syncNow());
      await load(false);
    } catch {
      setSyncProblem(true);
    } finally {
      setSyncing(false);
    }
  }, [load]);

  const skipSheet = useCallback(async () => {
    try {
      await markHealthAsked();
      setAsked(true);
    } catch {
      setSyncProblem(true);
    }
  }, []);

  async function save(values: SleepValues) {
    await addSleep(values);
    await load(false);
  }

  async function remove(id: string) {
    setBusyId(id);
    setDeleteProblem(false);
    try {
      await deleteSleep(id);
      await load(false);
    } catch {
      setDeleteProblem(true);
    } finally {
      setBusyId(null);
    }
  }

  const sheet = status !== 'error' && asked !== null && shouldOfferHealthSheet(healthOn, asked);
  const view = loaded?.view;
  const manual = loaded ? showManualEntry(loaded.sessions, healthOn, last?.nights ?? null) : null;
  const formOpen = formHeld || (manual?.open ?? false);
  const accent = !sheet && status === 'ready';
  const saveIsRed = accent && formOpen;
  const syncIsRed = accent && !formOpen;

  return (
    <>
      <ScrollView
        style={s.flex}
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void reload()} tintColor={color.ink} />}
      >
        <Text style={s.largeTitle} accessibilityRole="header">Sleep</Text>

        {status === 'loading' ? <LoadingSleep /> : null}
        {status === 'error' ? (
          <View style={s.card}>
            <Text style={s.title}>Your sleep could not be loaded</Text>
            <ErrorNotice message={NEXT.load} />
            <Button label="Try again" tone={sheet ? 'quiet' : 'red'} onPress={() => void load(true)} />
          </View>
        ) : null}

        {status === 'ready' && view && loaded && manual ? (
          <>
            <Summary view={view} stacked={stacked} />
            {refreshProblem ? <ErrorNotice message={NEXT.load} /> : null}
            {view.nights.length > 0 ? (
              <View style={s.card}>
                <Text style={s.label}>Nights</Text>
                <Text style={s.hint}>One source is used for each night. Another source is listed beside it and is not added in.</Text>
                {view.nights.slice(0, shown).map((night, index) => (
                  <NightRow
                    key={`${night.key}-${night.main.session.id}`}
                    line={nightLine(night, view.band)}
                    first={index === 0}
                    stacked={stacked}
                    busy={busyId === night.main.session.members[0]}
                    onDelete={(id) => void remove(id)}
                  />
                ))}
                {view.nights.length > shown ? (
                  <Button label="Show earlier nights" tone="quiet" onPress={() => setShown((count) => count + PAGE)} />
                ) : null}
              </View>
            ) : null}
            {manual.offered && !formOpen ? (
              <Button label="Add a night by hand" tone="quiet" onPress={() => setFormHeld(true)} />
            ) : null}
            {formOpen ? (
              <ManualEntry
                key={loaded.sessions.filter((item) => item.sourceKind === 'manual').length}
                today={loaded.today}
                nowMs={loaded.nowMs}
                existing={loaded.sessions}
                accent={saveIsRed}
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
            {deleteProblem ? <ErrorNotice message={NEXT.remove} /> : null}
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

        {syncProblem && !sheet ? <ErrorNotice message={NEXT.sync} /> : null}
        <Button label="Sign out" tone="quiet" onPress={() => void supabase.auth.signOut()} />
      </ScrollView>
      <PermissionSheet visible={sheet} busy={syncing} problem={sheet && syncProblem} onContinue={() => void runSync()} onNotNow={() => void skipSheet()} />
    </>
  );
}

function LoadingSleep() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), SLOW_LOAD_MS);
    return () => clearTimeout(id);
  }, []);
  return (
    <View style={s.field}>
      <ActivityIndicator
        color={color.ink}
        accessibilityLabel={slow ? 'Loading your sleep. Still working' : 'Loading your sleep'}
      />
      {slow ? <Text style={s.hint}>Still working</Text> : null}
    </View>
  );
}

function Summary({ view, stacked }: { view: SleepPresentation; stacked: boolean }) {
  const figures = view.showAverages ? averageFigures(view.summary, view.band) : null;
  return (
    <View style={s.card}>
      <Text style={s.label}>Last {view.summary.windowDays} days</Text>
      {figures ? (
        <>
          <View style={[s.stats, stacked && s.stacked]}>
            <Stat label="Time asleep" value={figures.asleep} note={figures.asleepNote} stacked={stacked} />
            {figures.fellAsleep ? <Stat label="Usually asleep" value={figures.fellAsleep} note={figures.fellAsleepNote ?? undefined} stacked={stacked} /> : null}
            {figures.woke ? <Stat label="Usually up" value={figures.woke} note={figures.wokeNote ?? undefined} stacked={stacked} /> : null}
            <Stat label="Nights" value={figures.nights} note="with a record" stacked={stacked} />
          </View>
          <Text style={s.hint}>{figures.footnote}</Text>
        </>
      ) : (
        <Text style={s.body}>{waitingCopy(view.summary)}</Text>
      )}
    </View>
  );
}

function Stat({ label, value, note, stacked }: { label: string; value: string; note?: string; stacked: boolean }) {
  return (
    <View style={[s.stat, stacked && s.statStacked]}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.number}>{value}</Text>
      {note ? <Text style={s.hint}>{note}</Text> : null}
    </View>
  );
}

function NightRow({
  line,
  first,
  stacked,
  busy,
  onDelete,
}: {
  line: NightLine;
  first: boolean;
  stacked: boolean;
  busy: boolean;
  onDelete: (id: string) => void;
}) {
  function ask() {
    const run = () => onDelete(line.deleteId);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Delete this night', 'Keep'], cancelButtonIndex: 1, userInterfaceStyle: 'light' },
        (index) => { if (index === 0) run(); },
      );
      return;
    }
    Alert.alert('Delete this night', undefined, [
      { text: 'Delete this night', onPress: run },
      { text: 'Keep', style: 'cancel' },
    ]);
  }

  return (
    <View style={[s.night, first && s.nightFirst]}>
      <View style={[s.nightTop, stacked && s.stacked]}>
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
        <Button label="Delete" tone="quiet" busy={busy} onPress={ask} accessibilityLabel={`Delete ${line.heading}`} />
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
      {empty ? <Text style={s.hint}>{HEALTH_SETTINGS_HINT}</Text> : null}
      <Button label="Sync now" tone={tone} onPress={onSync} busy={busy} accessibilityLabel="Sync Apple Health now" />
    </View>
  );
}
