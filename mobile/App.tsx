import type { Session } from '@supabase/supabase-js';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView, Text, View } from 'react-native';
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
          <View style={s.wrap}>
            <Text style={s.brand}>INTUS</Text>
            <View style={s.flex}>
              <SignIn deleted={deleted} />
            </View>
            <Text style={s.footer}>Not medical advice. Ranges are flagged, never diagnosed.</Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
