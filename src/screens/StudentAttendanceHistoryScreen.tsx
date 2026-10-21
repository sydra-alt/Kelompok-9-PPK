import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { AppColors, CardShadow, Radius } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';
import { getSessionsByClass } from '@/data/schedules';
import { getUserById } from '@/data/users';
import { useStudentAttendance } from '@/hooks/use-student-attendance';
import { navigateTo } from '@/navigation/AppNavigator';
import type { AttendanceRecord, PracticeSession } from '@/types';
import { formatClock, formatDate } from '@/utils/format';

type HistoryStatus = 'present' | 'absent' | 'pending';

interface HistoryEntry {
  session: PracticeSession;
  record?: AttendanceRecord;
  status: HistoryStatus;
}

const HISTORY_META: Record<HistoryStatus, { label: string; color: string; background: string; icon: string }> = {
  present: { label: 'Hadir', color: AppColors.success, background: AppColors.successSoft, icon: '✓' },
  absent: { label: 'Tidak Hadir', color: AppColors.danger, background: AppColors.dangerSoft, icon: '✕' },
  pending: { label: 'Belum Presensi', color: AppColors.warning, background: AppColors.warningSoft, icon: '…' },
};

/** FR-07 — Riwayat kehadiran praktikan. */
export default function StudentAttendanceHistoryScreen() {
  const { studentId } = useLocalSearchParams<{ studentId: string }>();
  const student = getUserById(studentId);
  const records = useStudentAttendance(studentId);

  const entries = useMemo<HistoryEntry[]>(() => {
    if (!student || student.role !== 'student') return [];
    const recordBySession = new Map(records.map((r) => [r.sessionId, r]));
    return getSessionsByClass(student.className)
      .filter((session) => session.status !== 'upcoming' || recordBySession.has(session.id))
      .map((session) => {
        const record = recordBySession.get(session.id);
        const status: HistoryStatus = record ? 'present' : session.status === 'closed' ? 'absent' : 'pending';
        return { session, record, status };
      })
      .reverse(); // terbaru di atas
  }, [records, student]);

  if (!student || student.role !== 'student') {
    return (
      <EmptyState
        icon="🔍"
        title="Identitas tidak ditemukan"
        message="Silakan kembali dan pilih identitas praktikan yang valid."
        actionLabel="Pilih Identitas"
        onAction={navigateTo.roleSelection}
      />
    );
  }

  const presentCount = entries.filter((e) => e.status === 'present').length;
  const absentCount = entries.filter((e) => e.status === 'absent').length;
  const counted = presentCount + absentCount;
  const rate = counted > 0 ? Math.round((presentCount / counted) * 100) : 0;

  return (
    <FlatList
      data={entries}
      keyExtractor={(item) => item.session.id}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListHeaderComponent={
        entries.length > 0 ? (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Ringkasan Kehadiran</Text>
            <Text style={styles.summarySubtitle}>
              {student.name} • {student.className}
            </Text>
            <View style={styles.summaryRow}>
              <SummaryItem value={String(presentCount)} label="Hadir" color={AppColors.success} />
              <SummaryItem value={String(absentCount)} label="Tidak Hadir" color={AppColors.danger} />
              <SummaryItem value={`${rate}%`} label="Kehadiran" color={AppColors.primary} />
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${rate}%` }]} />
            </View>
          </View>
        ) : undefined
      }
      renderItem={({ item }) => <HistoryItem entry={item} />}
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

function HistoryItem({ entry }: { entry: HistoryEntry }) {
  const meta = HISTORY_META[entry.status];
  return (
    <View testID={`history-item-${entry.session.id}`} style={styles.item}>
      <View style={[styles.itemIcon, { backgroundColor: meta.background }]}>
        <Text style={[styles.itemIconText, { color: meta.color }]}>{meta.icon}</Text>
      </View>
      <View style={styles.itemBody}>
        <Text style={styles.itemTitle}>{entry.session.practicalName}</Text>
        <Text style={styles.itemMeta}>
          {entry.session.className} • {formatDate(entry.session.date)}
        </Text>
        <Text style={styles.itemTime}>
          {entry.record
            ? `Presensi pukul ${formatClock(entry.record.attendanceTime)} WIB`
            : entry.status === 'pending'
              ? 'Sesi masih dibuka — segera lakukan presensi'
              : 'Tidak ada catatan presensi'}
        </Text>
      </View>
      <View style={[styles.itemBadge, { backgroundColor: meta.background }]}>
        <Text style={[styles.itemBadgeText, { color: meta.color }]}>{meta.label}</Text>
      </View>
    </View>
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
    marginBottom: Spacing.three,
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
    fontSize: 22,
    fontWeight: '800',
  },
  summaryLabel: {
    fontSize: 12,
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
