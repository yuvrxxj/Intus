import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { colors } from '../../theme/tokens';

// Five tabs, the most the system tab bar should carry. Supplements, sleep and the account live under More.
export default function TabsLayout() {
  return (
    <NativeTabs tintColor={colors.red}>
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="today">
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="sun.max" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="habits">
        <NativeTabs.Trigger.Label>Habits</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="checkmark.circle" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="bloodwork">
        <NativeTabs.Trigger.Label>Bloodwork</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="drop" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="more">
        <NativeTabs.Trigger.Label>More</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="ellipsis.circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
