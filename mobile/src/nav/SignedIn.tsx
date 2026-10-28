import type { Session } from '@supabase/supabase-js';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SymbolView } from 'expo-symbols';
import { createContext, useContext } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AccountScreen } from '../account/AccountScreen';
import { MoreScreen } from '../more/MoreScreen';
import { SleepScreen } from '../sleep/SleepScreen';
import { s } from '../theme/styles';
import { color, font } from '../theme/tokens';
import type { MoreParamList } from './types';

const SignedInContext = createContext<{ session: Session; onDeleted: () => void } | null>(null);

function useSignedIn(): { session: Session; onDeleted: () => void } {
  const value = useContext(SignedInContext);
  if (!value) throw new Error('Signed-in screens render inside SignedIn');
  return value;
}

const Tab = createBottomTabNavigator();
const MoreStack = createNativeStackNavigator<MoreParamList>();

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: color.paper,
    primary: color.ink,
    card: color.paper,
    text: color.ink,
    border: color.line,
    notification: color.red,
  },
};

const stackOptions = {
  headerLargeTitleEnabled: true,
  headerBackButtonDisplayMode: 'minimal' as const,
  headerTintColor: color.ink,
  headerStyle: { backgroundColor: color.paper },
  headerTitleStyle: { fontFamily: font.medium },
  headerLargeTitleStyle: { fontFamily: font.bold, fontSize: 34 },
  contentStyle: { backgroundColor: color.paper },
};

function AccountRoute() {
  const { session, onDeleted } = useSignedIn();
  const provider = (session.user.app_metadata?.provider as string | undefined) ?? null;
  return <AccountScreen email={session.user.email ?? null} provider={provider} onDeleted={onDeleted} />;
}

function MoreNavigator() {
  return (
    <MoreStack.Navigator screenOptions={stackOptions}>
      <MoreStack.Screen name="MoreHome" component={MoreScreen} options={{ title: 'More' }} />
      <MoreStack.Screen name="Account" component={AccountRoute} options={{ title: 'Account' }} />
    </MoreStack.Navigator>
  );
}

function SleepRoute() {
  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <View style={s.wrap}>
        <Text style={s.brand}>INTUS</Text>
        <View style={s.flex}>
          <SleepScreen />
        </View>
      </View>
    </SafeAreaView>
  );
}

/** Signed-in app: Sleep, and More, whose stack pushes Account with the system back chevron and a large title. */
export function SignedIn({ session, onDeleted }: { session: Session; onDeleted: () => void }) {
  return (
    <SignedInContext.Provider value={{ session, onDeleted }}>
    <NavigationContainer theme={theme}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: color.ink,
          tabBarInactiveTintColor: color.ink3,
          tabBarStyle: { backgroundColor: color.paper },
          tabBarLabelStyle: { fontFamily: font.medium },
        }}
      >
        <Tab.Screen
          name="Sleep"
          options={{
            tabBarIcon: ({ color: tint }) => <SymbolView name="bed.double" tintColor={tint} size={22} />,
          }}
          component={SleepRoute}
        />
        <Tab.Screen
          name="More"
          component={MoreNavigator}
          options={{
            tabBarIcon: ({ color: tint }) => <SymbolView name="ellipsis" tintColor={tint} size={22} />,
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
    </SignedInContext.Provider>
  );
}
