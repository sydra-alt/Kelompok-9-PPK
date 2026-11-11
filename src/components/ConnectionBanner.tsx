import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppColors, Radius } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';

interface ConnectionBannerProps {
  isOffline: boolean;
  fromCache?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

/**
 * Banner status koneksi / cache / kegagalan memuat data beserta tombol Retry.
 */
export function ConnectionBanner({ isOffline, fromCache = false, error, onRetry }: ConnectionBannerProps) {
  if (!isOffline && !fromCache && !error) return null;

  const isError = Boolean(error);
  const title = isError
    ? 'Gagal memuat data'
    : isOffline
      ? 'Kamu sedang offline'
      : 'Menampilkan data tersimpan';
  const message =
    error ??
    (isOffline
      ? 'Periksa koneksi internet. Perubahan akan disinkronkan saat kembali online.'
      : 'Sedang menyinkronkan data terbaru dengan server...');

  return (
    <View
      testID="connection-banner"
      accessibilityRole="alert"
      style={[styles.banner, isError ? styles.bannerError : styles.bannerWarning]}>
      <Text style={styles.icon}>{isError ? '⚠️' : '📡'}</Text>
      <View style={styles.body}>
        <Text style={[styles.title, { color: isError ? AppColors.danger : AppColors.warning }]}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
      {onRetry ? (
        <Pressable
          testID="connection-retry-button"
          onPress={onRetry}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.retryButton,
            isError ? styles.retryButtonError : styles.retryButtonWarning,
            pressed && styles.pressed,
          ]}>
          <Text style={[styles.retryText, { color: isError ? AppColors.danger : AppColors.warning }]}>
            Coba Lagi
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 4,
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  bannerWarning: {
    backgroundColor: AppColors.warningSoft,
    borderColor: AppColors.warning,
  },
  bannerError: {
    backgroundColor: AppColors.dangerSoft,
    borderColor: AppColors.danger,
  },
  icon: {
    fontSize: 18,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
  },
  message: {
    fontSize: 12,
    lineHeight: 17,
    color: AppColors.text,
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    backgroundColor: AppColors.surface,
  },
  retryButtonWarning: {
    borderColor: AppColors.warning,
  },
  retryButtonError: {
    borderColor: AppColors.danger,
  },
  retryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.8,
  },
});

