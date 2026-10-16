import { Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { JetBrainsMono_500Medium, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '../auth/AuthContext';
import { TodayProvider } from '../today/TodayContext';
import { colors } from '../theme/tokens';

// Hold the splash until the fonts are in, so no screen paints in the system font first.
SplashScreen.preventAutoHideAsync();

function Routes() {
  const { session } = useAuth();
  // the keychain is still being read: show nothing rather than flash the sign-in screen
  if (session === undefined) return null;
  return (
    <Stack screenOptions={{ contentStyle: { backgroundColor: colors.paper }, headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  // an error still releases the splash: the app falls back to the system font rather than hang
  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <>
      <StatusBar style="dark" />
      <AuthProvider>
        <TodayProvider>
          <Routes />
        </TodayProvider>
      </AuthProvider>
    </>
  );
}
