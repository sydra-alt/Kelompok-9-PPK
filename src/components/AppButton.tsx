import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { AppColors, Radius } from '@/constants/app-theme';

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
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}>
      <Text style={[styles.text, textStyles[variant], disabled && styles.disabledText]}>{title}</Text>
    </Pressable>
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
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
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
