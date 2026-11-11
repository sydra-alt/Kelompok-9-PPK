import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppColors } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';

interface LoadingStateProps {
  title?: string;
  message?: string;
}

/** Tampilan indikator pemuatan data atau pemulihan sesi. */
export function LoadingState({
  title = 'Memuat data...',
  message = 'Mohon tunggu sebentar.',
}: LoadingStateProps) {
  return (
    <View style={styles.container} accessibilityRole="progressbar">
      <ActivityIndicator size="large" color={AppColors.primary} />
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.text,
    marginTop: Spacing.two,
    textAlign: 'center',
  },
  message: {
    fontSize: 13,
    lineHeight: 19,
    color: AppColors.textMuted,
    textAlign: 'center',
    maxWidth: 300,
  },
});

