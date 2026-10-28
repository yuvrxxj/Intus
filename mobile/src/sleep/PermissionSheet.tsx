import { Modal, SafeAreaView, Text, View } from 'react-native';
import { s } from '../theme/styles';
import { Button } from '../ui/Button';
import { HEALTH_SHARE_PURPOSE, HEALTH_SHEET } from './rules';

/** Shown once, before iOS presents its own Health permission sheet. */
export function PermissionSheet({
  visible,
  busy,
  error,
  onContinue,
  onNotNow,
}: {
  visible: boolean;
  busy: boolean;
  error: string | null;
  onContinue: () => void;
  onNotNow: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onNotNow}>
      <SafeAreaView style={s.screen}>
        <View style={s.wrap}>
          <Text style={s.label}>Apple Health</Text>
          <Text style={s.title} accessibilityRole="header">{HEALTH_SHEET.title}</Text>
          <Text style={s.body}>{HEALTH_SHARE_PURPOSE}</Text>
          <View style={s.card}>
            <Text style={s.label}>Intus reads</Text>
            {HEALTH_SHEET.reads.map((item) => (
              <Text key={item} style={s.body}>{item}</Text>
            ))}
          </View>
          <Text style={s.hint}>{HEALTH_SHEET.aside}</Text>
          <Text style={s.hint}>{HEALTH_SHEET.denial}</Text>
          <Text style={s.hint}>Apple shows its own permission sheet next. Background updates stay off. Sync is the button.</Text>
          {error ? <Text style={s.error} accessibilityRole="alert">{error}</Text> : null}
          <Button label="Continue" tone="red" onPress={onContinue} busy={busy} accessibilityLabel="Continue to Apple Health permission" />
          <Button label="Not now" tone="quiet" onPress={onNotNow} disabled={busy} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
