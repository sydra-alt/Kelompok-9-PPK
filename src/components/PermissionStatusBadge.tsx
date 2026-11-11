import { StyleSheet, Text, View } from 'react-native';

import { AppColors, Radius } from '@/constants/app-theme';
import type { AiClassification, PermissionStatus } from '@/types';

export const PERMISSION_STATUS_META: Record<
  PermissionStatus,
  { label: string; color: string; background: string; icon: string }
> = {
  pending: {
    label: 'Menunggu Keputusan',
    color: AppColors.warning,
    background: AppColors.warningSoft,
    icon: '⏳',
  },
  approved: {
    label: 'Disetujui',
    color: AppColors.success,
    background: AppColors.successSoft,
    icon: '✅',
  },
  rejected: {
    label: 'Ditolak',
    color: AppColors.danger,
    background: AppColors.dangerSoft,
    icon: '❌',
  },
};

/** Badge status keputusan pengajuan izin (`pending` / `approved` / `rejected`). */
export function PermissionStatusBadge({ status }: { status: PermissionStatus }) {
  const meta = PERMISSION_STATUS_META[status];
  return (
    <View style={[styles.badge, { backgroundColor: meta.background }]}>
      <Text style={styles.icon}>{meta.icon}</Text>
      <Text style={[styles.label, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

/**
 * Chip informasi pendukung hasil klasifikasi AI.
 * Ditampilkan terpisah dari status keputusan asisten.
 */
export function AiCategoryChip({ classification }: { classification: AiClassification }) {
  if (classification.status === 'success' && classification.category) {
    const confidenceText =
      typeof classification.confidence === 'number'
        ? ` (${Math.round(classification.confidence * 100)}%)`
        : '';
    return (
      <View style={[styles.badge, { backgroundColor: AppColors.primarySoft }]}>
        <Text style={styles.icon}>🤖</Text>
        <Text style={[styles.label, { color: AppColors.primaryDark }]}>
          Kategori AI: {classification.category}
          {confidenceText}
        </Text>
      </View>
    );
  }

  if (classification.status === 'pending') {
    return (
      <View style={[styles.badge, { backgroundColor: AppColors.neutralSoft }]}>
        <Text style={styles.icon}>🤖</Text>
        <Text style={[styles.label, { color: AppColors.neutral }]}>Klasifikasi AI sedang diproses...</Text>
      </View>
    );
  }

  if (classification.status === 'failed') {
    return (
      <View style={[styles.badge, { backgroundColor: AppColors.warningSoft }]}>
        <Text style={styles.icon}>🤖</Text>
        <Text style={[styles.label, { color: AppColors.warning }]}>
          Tanpa klasifikasi AI (tetap diproses asisten)
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.badge, { backgroundColor: AppColors.neutralSoft }]}>
      <Text style={styles.icon}>🤖</Text>
      <Text style={[styles.label, { color: AppColors.neutral }]}>Klasifikasi AI tidak aktif</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  icon: {
    fontSize: 11,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
  },
});

