import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { AppColors, Radius } from '@/constants/app-theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Variant = 'primary' | 'secondary' | 'ghost';

interface AppButtonProps {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Tombol standar aplikasi. */
export function AppButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
  testID,
}: AppButtonProps) {
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: scale.value < 1 ? 0.86 : 1,
  }));

  return (
    <AnimatedPressable
      testID={testID}
      onPress={onPress}
      onPressIn={() => {
        if (!disabled) scale.set(withSpring(0.97, { damping: 16, stiffness: 300 }));
      }}
      onPressOut={() => {
        scale.set(withSpring(1, { damping: 14, stiffness: 260 }));
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={[
        styles.base,
        variantStyles[variant],
        disabled && styles.disabled,
        pressStyle,
        style,
      ]}>
      <Text style={[styles.text, textStyles[variant], disabled && styles.disabledText]}>{title}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    paddingHorizontal: 20,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    backgroundColor: AppColors.neutralSoft,
    borderColor: AppColors.neutralSoft,
  },
  text: {
    fontSize: 15,
    fontWeight: '700',
  },
  disabledText: {
    color: AppColors.textMuted,
  },
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: AppColors.primary },
  secondary: { backgroundColor: AppColors.primarySoft },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: AppColors.border },
});

const textStyles = StyleSheet.create({
  primary: { color: AppColors.textOnPrimary },
  secondary: { color: AppColors.primary },
  ghost: { color: AppColors.text },
});
