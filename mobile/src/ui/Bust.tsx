import MaskedView from '@react-native-masked-view/masked-view';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, View } from 'react-native';

// The web's statue bust (src/components/statue-bust.tsx), the same picture: the chest rises and falls a little, and
// every eight seconds a band of lighter paper crosses the stone, lighting only the statue.
const BUST = require('../../../src/assets/art/statue-bust.webp');
const RATIO = 1031 / 1349;
const BAND = [0.04, 0.14, 0.3, 0.46, 0.6, 0.46, 0.3, 0.14, 0.04];

export function Bust({ height }: { height: number }) {
  const width = height * RATIO;
  const [still, setStill] = useState(false);
  const breathe = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setStill);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setStill);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (still) return;
    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 3500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 3500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    const sweeping = Animated.loop(
      Animated.sequence([
        Animated.delay(1800),
        Animated.timing(sweep, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(2200),
        Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    breathing.start();
    sweeping.start();
    return () => {
      breathing.stop();
      sweeping.stop();
    };
  }, [still, breathe, sweep]);

  // scaled from the bottom edge, as the web does
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] });
  const lift = breathe.interpolate({ inputRange: [0, 1], outputRange: [0, -(height * 0.01)] });
  const bandX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-width * 0.8, width * 1.2] });

  return (
    <Animated.View
      accessible
      accessibilityRole="image"
      accessibilityLabel="A marble bust"
      style={{ width, height, transform: [{ translateY: lift }, { scale }] }}
    >
      <Image source={BUST} style={{ width, height }} resizeMode="contain" />
      {still ? null : (
        <MaskedView
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          maskElement={<Image source={BUST} style={{ width, height }} resizeMode="contain" />}
        >
          <View style={StyleSheet.absoluteFill}>
            <Animated.View
              style={{
                position: 'absolute',
                top: -height * 0.1,
                bottom: -height * 0.1,
                width: width * 0.45,
                flexDirection: 'row',
                transform: [{ translateX: bandX }, { skewX: '-10deg' }],
              }}
            >
              {/* feathered edges: strips that fade in to the middle and out again, as the web's gradient does */}
              {BAND.map((alpha, i) => (
                <View key={i} style={{ flex: 1, backgroundColor: `rgba(229, 236, 233, ${alpha})` }} />
              ))}
            </Animated.View>
          </View>
        </MaskedView>
      )}
    </Animated.View>
  );
}
