import { Text, View } from 'react-native';
import { s } from '../theme/styles';

/** A real failure: red tint, a mono ERROR kicker, and a plain next step. Not for warnings. */
export function ErrorNotice({ message }: { message: string }) {
  return (
    <View style={s.errorNotice} accessibilityRole="alert">
      <Text style={s.errorKicker}>ERROR</Text>
      <Text style={s.noticeBody}>{message}</Text>
    </View>
  );
}
