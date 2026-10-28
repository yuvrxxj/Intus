import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, ScrollView, Text } from 'react-native';
import { SymbolView } from 'expo-symbols';
import type { MoreParamList } from '../nav/types';
import { color } from '../theme/tokens';
import { s } from '../theme/styles';

/** The list under the More tab. Account is the next screen on this stack. The disclaimer lives here and nowhere else. */
export function MoreScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MoreParamList>>();
  return (
    <ScrollView style={s.flex} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={s.scroll}>
      <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Account')} style={s.listRow}>
        <Text style={s.body}>Account</Text>
        <SymbolView name="chevron.right" tintColor={color.ink3} size={16} />
      </Pressable>
      <Text style={s.footer}>Not medical advice. Ranges are flagged, never diagnosed.</Text>
    </ScrollView>
  );
}
