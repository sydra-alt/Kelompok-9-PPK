import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppColors, Radius } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';

export type FeedbackType = 'success' | 'error' | 'info';

const META: Record<FeedbackType, { icon: string; color: string; background: string }> = {
  success: { icon: '✅', color: AppColors.success, background: AppColors.successSoft },
  error: { icon: '⛔', color: AppColors.danger, background: AppColors.dangerSoft },
  info: { icon: 'ℹ️', color: AppColors.warning, background: AppColors.warningSoft },
};

interface FeedbackBannerProps {
  type: FeedbackType;
  title: string;
  message: string;
  onClose?: () => void;
  testID?: string;
}

/** Banner umpan balik berhasil / gagal / informasi. */
export function FeedbackBanner({ type, title, message, onClose, testID }: FeedbackBannerProps) {
  const meta = META[type];
  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      style={[styles.banner, { backgroundColor: meta.background, borderColor: meta.color }]}>
      <Text style={styles.icon}>{meta.icon}</Text>
      <View style={styles.content}>
        <Text style={[styles.title, { color: meta.color }]}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
      {onClose ? (
        <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Tutup pesan">
          <Text style={[styles.close, { color: meta.color }]}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two + 4,
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  icon: {
    fontSize: 18,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  message: {
    fontSize: 13,
    lineHeight: 19,
    color: AppColors.text,
  },
  close: {
    fontSize: 16,
    fontWeight: '700',
  },
});
