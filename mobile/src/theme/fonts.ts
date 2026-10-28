import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';
import { JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono/700Bold';
import { useFonts } from 'expo-font';

/** True once Inter and JetBrains Mono are ready, or once loading has failed and the system face will stand in. */
export function useIntusFonts(): { ready: boolean } {
  const [loaded, error] = useFonts({
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });
  return { ready: loaded || error != null };
}
