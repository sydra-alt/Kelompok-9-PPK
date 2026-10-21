import { StyleSheet, Text, View } from 'react-native';

import { AppColors, Radius } from '@/constants/app-theme';
import type { SessionStatus } from '@/types';

export const SESSION_STATUS_META: Record<
  SessionStatus,
  { label: string; color: string; background: string }
> = {
  upcoming: { label: 'Belum Dibuka', color: AppColors.warning, background: AppColors.warningSoft },
  open: { label: 'Dibuka', color: AppColors.success, background: AppColors.successSoft },
  closed: { label: 'Ditutup', color: AppColors.neutral, background: AppColors.neutralSoft },
};

interface StatusBadgeProps {
  status: SessionStatus;
}

/** Badge status sesi — komponen bersama untuk layar praktikan & asisten. */
export function StatusBadge({ status }: StatusBadgeProps) {
  const meta = SESSION_STATUS_META[status];
  return (
    <View style={[styles.badge, { backgroundColor: meta.background }]}>
      <View style={[styles.dot, { backgroundColor: meta.color }]} />
      <Text style={[styles.label, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: Radius.pill,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
});
