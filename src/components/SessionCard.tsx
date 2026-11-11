import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PERMISSION_STATUS_META } from '@/components/PermissionStatusBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { AppColors, CardShadow, Radius } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';
import type { PermissionStatus, PracticeSession } from '@/types';
import { formatDate, formatTimeRange } from '@/utils/format';

interface SessionCardProps {
  session: PracticeSession;
  onPress?: () => void;
  /** Tampilkan penanda "Sudah presensi" (alur praktikan). */
  attended?: boolean;
  /** Status pengajuan izin pada sesi ini bila ada (alur praktikan). */
  permissionStatus?: PermissionStatus;
  /** Slot tambahan di bagian bawah kartu (mis. aksi asisten). */
  footer?: ReactNode;
  testID?: string;
}

/** Kartu jadwal sesi praktikum — dipakai di daftar jadwal praktikan maupun asisten. */
export function SessionCard({
  session,
  onPress,
  attended,
  permissionStatus,
  footer,
  testID,
}: SessionCardProps) {
  const permissionMeta = permissionStatus ? PERMISSION_STATUS_META[permissionStatus] : null;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${session.practicalName} ${session.className}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={[styles.accentBar, session.status === 'open' && styles.accentBarOpen]} />
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <View style={styles.titleBlock}>
            <Text style={styles.title} numberOfLines={1}>
              {session.practicalName}
            </Text>
            {session.topic ? (
              <Text style={styles.topic} numberOfLines={1}>
                {session.topic}
              </Text>
            ) : null}
          </View>
          <StatusBadge status={session.status} />
        </View>

        <View style={styles.metaRow}>
          <MetaChip icon="🏷️" text={session.className} />
          <MetaChip icon="📅" text={formatDate(session.date)} />
          <MetaChip icon="⏰" text={formatTimeRange(session.startTime, session.endTime)} />
        </View>

        {attended ? (
          <View style={styles.attendedPill}>
            <Text style={styles.attendedText}>✓ Sudah presensi</Text>
          </View>
        ) : permissionMeta ? (
          <View style={[styles.attendedPill, { backgroundColor: permissionMeta.background }]}>
            <Text style={[styles.attendedText, { color: permissionMeta.color }]}>
              {permissionMeta.icon} Izin: {permissionMeta.label}
            </Text>
          </View>
        ) : null}

        {footer}
      </View>
    </Pressable>
  );
}

function MetaChip({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.metaChip}>
      <Text style={styles.metaIcon}>{icon}</Text>
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: AppColors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: AppColors.border,
    overflow: 'hidden',
    ...CardShadow,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  accentBar: {
    width: 5,
    backgroundColor: AppColors.border,
  },
  accentBarOpen: {
    backgroundColor: AppColors.success,
  },
  body: {
    flex: 1,
    padding: Spacing.three,
    gap: Spacing.two + 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  titleBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.text,
  },
  topic: {
    fontSize: 13,
    color: AppColors.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: AppColors.background,
  },
  metaIcon: {
    fontSize: 11,
  },
  metaText: {
    fontSize: 12,
    color: AppColors.neutral,
    fontWeight: '500',
  },
  attendedPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: AppColors.primarySoft,
  },
  attendedText: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.primary,
  },
});
