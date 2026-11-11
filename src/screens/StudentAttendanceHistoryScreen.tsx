import { router } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { ConnectionBanner } from '@/components/ConnectionBanner';
import { EmptyState } from '@/components/EmptyState';
import { LoadingState } from '@/components/LoadingState';
import { AppColors, CardShadow, Radius } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useStudentData } from '@/context/StudentDataContext';
import { navigateTo } from '@/navigation/AppNavigator';
import type { AttendanceRecord, PermissionRequest, PracticeSession } from '@/types';
import { formatClock, formatDate } from '@/utils/format';

type HistoryStatus = 'present' | 'excused' | 'absent' | 'pending';

interface HistoryEntry {
  session: PracticeSession;
  record?: AttendanceRecord;
  permission?: PermissionRequest;
  status: HistoryStatus;
}

const HISTORY_META: Record<
  HistoryStatus,
  { label: string; color: string; background: string; icon: string }
> = {
  present: {
    label: 'Hadir',
    color: AppColors.success,
    background: AppColors.successSoft,
    icon: '✓',
  },
  excused: {
    label: 'Izin Disetujui',
    color: AppColors.primaryDark,
    background: AppColors.primarySoft,
    icon: '📝',
  },
  absent: {
    label: 'Tidak Hadir',
    color: AppColors.danger,
    background: AppColors.dangerSoft,
    icon: '✕',
  },
  pending: {
    label: 'Belum Presensi',
    color: AppColors.warning,
    background: AppColors.warningSoft,
    icon: '…',
  },
};

/** FR-07 (Sprint 2) — Riwayat kehadiran praktikan secara real-time dari Firestore. */
export default function StudentAttendanceHistoryScreen() {
  const { profile } = useAuth();
  const {
    sessions,
    attendance,
    permissionRequests,
    classNamesLabel,
    loading,
    error,
    fromCache,
    isOffline,
    retry,
  } = useStudentData();

  const entries = useMemo<HistoryEntry[]>(() => {
    if (!profile || profile.role !== 'praktikan') return [];
    const recordBySession = new Map(attendance.map((r) => [r.sessionId, r]));
    const permissionBySession = new Map(permissionRequests.map((p) => [p.sessionId, p]));

    return sessions
      .filter(
        (session) =>
          session.status !== 'scheduled' ||
          recordBySession.has(session.id) ||
          permissionBySession.has(session.id),
      )
      .map((session) => {
        const record = recordBySession.get(session.id);
        const permission = permissionBySession.get(session.id);
        const status: HistoryStatus = record
          ? 'present'
          : permission?.status === 'approved'
            ? 'excused'
            : session.status === 'closed'
              ? 'absent'
              : 'pending';
        return { session, record, permission, status };
      })
      .reverse(); // terbaru di atas
  }, [profile, sessions, attendance, permissionRequests]);

  if (!profile || profile.role !== 'praktikan') {
    return (
      <EmptyState
        icon="🔍"
        title="Akses Praktikan Diperlukan"
        message="Silakan masuk menggunakan akun praktikan untuk melihat riwayat kehadiran."
        actionLabel="Kembali ke Login"
        onAction={navigateTo.roleSelection}
      />
    );
  }

  if (loading && sessions.length === 0 && attendance.length === 0) {
    return (
      <LoadingState
        title="Memuat riwayat kehadiran..."
        message="Mengambil catatan presensi praktikan dari Firestore."
      />
    );
  }

  if (error && sessions.length === 0 && attendance.length === 0) {
    return (
      <EmptyState
        icon="⚠️"
        title="Gagal memuat riwayat"
        message={error}
        actionLabel="Coba Lagi"
        onAction={retry}
      />
    );
  }

  const presentCount = entries.filter((e) => e.status === 'present').length;
  const excusedCount = entries.filter((e) => e.status === 'excused').length;
  const absentCount = entries.filter((e) => e.status === 'absent').length;
  const counted = presentCount + excusedCount + absentCount;
  const rate = counted > 0 ? Math.round(((presentCount + excusedCount) / counted) * 100) : 0;

  return (
    <FlatList
      data={entries}
      keyExtractor={(item) => item.session.id}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListHeaderComponent={
        <View style={styles.headerBlock}>
          <ConnectionBanner
            isOffline={isOffline}
            fromCache={fromCache}
            error={error}
            onRetry={retry}
          />

          {entries.length > 0 ? (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Ringkasan Kehadiran</Text>
              <Text style={styles.summarySubtitle}>
                {profile.name} ({profile.identifier}) • {classNamesLabel}
              </Text>
              <View style={styles.summaryRow}>
                <SummaryItem value={String(presentCount)} label="Hadir" color={AppColors.success} />
                <SummaryItem
                  value={String(excusedCount)}
                  label="Izin"
                  color={AppColors.primaryDark}
                />
                <SummaryItem
                  value={String(absentCount)}
                  label="Tidak Hadir"
                  color={AppColors.danger}
                />
                <SummaryItem value={`${rate}%`} label="Kehadiran" color={AppColors.primary} />
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${rate}%` }]} />
              </View>
            </View>
          ) : null}
        </View>
      }
      renderItem={({ item }) => (
        <HistoryItem
          entry={item}
          onPress={() => navigateTo.studentSessionDetail(profile.uid, item.session.id)}
        />
      )}
      ListEmptyComponent={
        <EmptyState
          icon="🗓️"
          title="Belum ada riwayat"
          message="Riwayat kehadiran akan muncul setelah ada sesi praktikum yang dibuka untuk kelasmu."
          actionLabel="Kembali ke Beranda"
          onAction={() => router.back()}
        />
      }
    />
  );
}

function SummaryItem({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function HistoryItem({ entry, onPress }: { entry: HistoryEntry; onPress: () => void }) {
  const meta = HISTORY_META[entry.status];
  const detailText = entry.record
    ? `Presensi pukul ${formatClock(entry.record.attendanceTime)} WIB`
    : entry.status === 'excused'
      ? 'Izin ketidakhadiran disetujui asisten'
      : entry.permission?.status === 'pending'
        ? 'Pengajuan izin sedang menunggu keputusan asisten'
        : entry.status === 'pending'
          ? 'Sesi masih dibuka — segera lakukan presensi'
          : 'Tidak ada catatan presensi';

  return (
    <Pressable
      testID={`history-item-${entry.session.id}`}
      onPress={onPress}
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
      <View style={[styles.itemIcon, { backgroundColor: meta.background }]}>
        <Text style={[styles.itemIconText, { color: meta.color }]}>{meta.icon}</Text>
      </View>
      <View style={styles.itemBody}>
        <Text style={styles.itemTitle}>{entry.session.practicalName}</Text>
        <Text style={styles.itemMeta}>
          {entry.session.className} • {formatDate(entry.session.date)}
        </Text>
        <Text style={styles.itemTime}>{detailText}</Text>
      </View>
      <View style={[styles.itemBadge, { backgroundColor: meta.background }]}>
        <Text style={[styles.itemBadgeText, { color: meta.color }]}>{meta.label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  listContent: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    padding: Spacing.three,
    paddingBottom: Spacing.six,
  },
  headerBlock: {
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  separator: {
    height: Spacing.two + 4,
  },
  summaryCard: {
    backgroundColor: AppColors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: Spacing.four,
    gap: Spacing.two + 2,
    ...CardShadow,
  },
  summaryTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: AppColors.text,
  },
  summarySubtitle: {
    fontSize: 13,
    color: AppColors.textMuted,
    marginTop: -6,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two + 2,
    borderRadius: Radius.md,
    backgroundColor: AppColors.background,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  summaryLabel: {
    fontSize: 11,
    color: AppColors.textMuted,
    fontWeight: '600',
  },
  progressTrack: {
    height: 8,
    borderRadius: Radius.pill,
    backgroundColor: AppColors.neutralSoft,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.pill,
    backgroundColor: AppColors.primary,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    backgroundColor: AppColors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  pressed: {
    opacity: 0.88,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIconText: {
    fontSize: 18,
    fontWeight: '800',
  },
  itemBody: {
    flex: 1,
    gap: 2,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.text,
  },
  itemMeta: {
    fontSize: 12,
    color: AppColors.textMuted,
  },
  itemTime: {
    fontSize: 12,
    color: AppColors.neutral,
    marginTop: 2,
  },
  itemBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  itemBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
