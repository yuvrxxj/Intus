import { Stack } from 'expo-router';
import { LargeTitleStack } from '../../../ui/LargeTitleStack';

export default function Layout() {
  return (
    <LargeTitleStack title="More">
      <Stack.Screen name="supplements" options={{ title: 'Supplements', headerLargeTitle: true }} />
      <Stack.Screen name="health" options={{ title: 'Apple Health', headerLargeTitle: true }} />
    </LargeTitleStack>
  );
}
