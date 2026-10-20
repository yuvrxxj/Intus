import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { colors, fonts } from '../theme/tokens';

/**
 * One tab's navigation stack: the system large title that shrinks into the bar as the page scrolls, with the page
 * scrolling underneath it. The first screen is the folder's index; pushed screens go in as children.
 */
export function LargeTitleStack({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerTransparent: true,
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        headerTintColor: colors.red,
        headerTitleStyle: { fontFamily: fonts.semibold, color: colors.ink },
        headerLargeTitleStyle: { fontFamily: fonts.semibold, color: colors.ink },
        contentStyle: { backgroundColor: colors.paper },
      }}
    >
      <Stack.Screen name="index" options={{ title }} />
      {children}
    </Stack>
  );
}
