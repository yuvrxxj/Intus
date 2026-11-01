import type { Session } from '@supabase/supabase-js';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SignIn } from './src/auth/SignIn';
import { SignedIn } from './src/nav/SignedIn';
import { supabase } from './src/supabase';
import { useIntusFonts } from './src/theme/fonts';
import { s } from './src/theme/styles';
import { color } from './src/theme/tokens';

export default function App() {
  const fonts = useIntusFonts();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) setDeleted(false);
  }, [session]);

  if (!fonts.ready || session === undefined) {
    return (
      <SafeAreaView style={s.screen}>
        <View style={s.center}>
          <ActivityIndicator color={color.ink} />
        </View>
      </SafeAreaView>
    );
  }

  if (session) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <SignedIn
          session={session}
          onDeleted={() => {
            setDeleted(true);
            setSession(null);
          }}
        />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.screen}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Scrolls so the fields and button stay reachable at the largest text sizes; the footer sits after the card. */}
          <ScrollView contentContainerStyle={s.signedOutScroll} keyboardShouldPersistTaps="handled">
            <Text style={s.brand}>INTUS</Text>
            <SignIn deleted={deleted} />
            <Text style={[s.footer, s.footerPinned]}>Not medical advice. Ranges are flagged, never diagnosed.</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
