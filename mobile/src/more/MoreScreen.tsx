import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, ScrollView, Text } from 'react-native';
import { SymbolView } from 'expo-symbols';
import * as WebBrowser from 'expo-web-browser';
import type { MoreParamList } from '../nav/types';
import { color } from '../theme/tokens';
import { s } from '../theme/styles';

/** The page both stores (and Health Connect's permission screen) point people to. It is the web app's privacy policy. */
export const PRIVACY_URL = 'https://intus.fit/privacy';

/** The list under the More tab. Account is the next screen on this stack. The disclaimer lives here and nowhere else. */
export function MoreScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MoreParamList>>();
  return (
    <ScrollView style={s.flex} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={s.pageScroll}>
      <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Account')} style={s.listRow}>
        <Text style={s.body}>Account</Text>
        <SymbolView name="chevron.right" tintColor={color.ink3} size={16} />
      </Pressable>
      <Pressable accessibilityRole="link" onPress={() => { void WebBrowser.openBrowserAsync(PRIVACY_URL); }} style={s.listRow}>
        <Text style={s.body}>Privacy policy</Text>
        <SymbolView name="arrow.up.right" tintColor={color.ink3} size={16} />
      </Pressable>
      <Text style={s.pageFooter}>Not medical advice. Ranges are flagged, never diagnosed.</Text>
    </ScrollView>
  );
}
