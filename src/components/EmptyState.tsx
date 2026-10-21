import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppColors, Radius } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';

interface EmptyStateProps {
  icon?: string;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Tampilan kondisi kosong untuk daftar atau data yang tidak ditemukan. */
export function EmptyState({ icon = '🗂️', title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction ? (
        <AppButton title={actionLabel} onPress={onAction} variant="secondary" style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: Radius.pill,
    backgroundColor: AppColors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  icon: {
    fontSize: 32,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: AppColors.text,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: AppColors.textMuted,
    textAlign: 'center',
    maxWidth: 320,
  },
  action: {
    marginTop: Spacing.three,
    alignSelf: 'stretch',
  },
});
