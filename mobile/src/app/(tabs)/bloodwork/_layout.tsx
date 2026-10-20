import { Stack } from 'expo-router';
import { LargeTitleStack } from '../../../ui/LargeTitleStack';

export default function Layout() {
  return (
    <LargeTitleStack title="Bloodwork">
      <Stack.Screen name="add" options={{ title: 'Add a result', headerLargeTitle: false }} />
      <Stack.Screen name="pick" options={{ title: 'Choose a marker', headerLargeTitle: false }} />
      <Stack.Screen name="marker/[id]" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.6, 1], sheetGrabberVisible: true, headerShown: false }} />
    </LargeTitleStack>
  );
}
