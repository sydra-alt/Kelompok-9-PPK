import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { EmptyState } from '@/components/EmptyState';
import { SessionCard } from '@/components/SessionCard';
import { AppColors, HeroGradient, Radius } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';
import { getSessionsByClass } from '@/data/schedules';
import { getUserById } from '@/data/users';
import { useStudentAttendance } from '@/hooks/use-student-attendance';
import { navigateTo } from '@/navigation/AppNavigator';
import type { SessionStatus } from '@/types';
import { getInitials } from '@/utils/format';

type Filter = 'all' | SessionStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'open', label: 'Dibuka' },
  { value: 'upcoming', label: 'Akan Datang' },
  { value: 'closed', label: 'Ditutup' },
];

/** FR-02 — Beranda praktikan & daftar jadwal. */
export default function StudentHomeScreen() {
  const { studentId } = useLocalSearchParams<{ studentId: string }>();
  const student = getUserById(studentId);
  const records = useStudentAttendance(studentId);
  const [filter, setFilter] = useState<Filter>('all');

  const sessions = useMemo(
    () => (student?.role === 'student' ? getSessionsByClass(student.className) : []),
    [student],
  );
  const filteredSessions = filter === 'all' ? sessions : sessions.filter((s) => s.status === filter);
  const attendedIds = useMemo(() => new Set(records.map((r) => r.sessionId)), [records]);

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

  const openCount = sessions.filter((s) => s.status === 'open').length;

  return (
    <>
      <StatusBar style="dark" />
      <FlatList
        data={filteredSessions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.profileCard}>
              <View style={styles.profileRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getInitials(student.name)}</Text>
                </View>
                <View style={styles.profileInfo}>
                  <Text style={styles.greeting}>Halo,</Text>
                  <Text style={styles.name}>{student.name}</Text>
                  <Text style={styles.meta}>
                    {student.identifier} • Kelas {student.className}
                  </Text>
                </View>
              </View>
              <View style={styles.statsRow}>
                <Stat label="Total Sesi" value={sessions.length} />
                <Stat label="Sedang Dibuka" value={openCount} />
                <Stat label="Sudah Hadir" value={records.length} />
              </View>
            </View>

            <AppButton
              testID="open-history-button"
              title="📋  Lihat Riwayat Kehadiran"
              variant="secondary"
              onPress={() => navigateTo.studentHistory(student.id)}
            />

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Jadwal Praktikum</Text>
            </View>

            <View style={styles.filterRow}>
              {FILTERS.map((item) => {
                const active = filter === item.value;
                return (
                  <Pressable
                    key={item.value}
                    testID={`filter-${item.value}`}
                    onPress={() => setFilter(item.value)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    style={[styles.filterChip, active && styles.filterChipActive]}>
                    <Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <SessionCard
            testID={`session-card-${item.id}`}
            session={item}
            attended={attendedIds.has(item.id)}
            onPress={() => navigateTo.studentSessionDetail(student.id, item.id)}
          />
        )}
        ListEmptyComponent={
          sessions.length === 0 ? (
            <EmptyState
              icon="📭"
              title="Belum ada jadwal"
              message={`Belum ada jadwal praktikum untuk kelas ${student.className}.`}
            />
          ) : (
            <EmptyState
              icon="🔎"
              title="Tidak ada sesi"
              message="Tidak ada sesi dengan status ini. Coba pilih filter lain."
              actionLabel="Tampilkan Semua"
              onAction={() => setFilter('all')}
            />
          )
        }
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
  header: {
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  profileCard: {
    backgroundColor: AppColors.primary,
    experimental_backgroundImage: HeroGradient,
    borderRadius: Radius.xl,
    padding: Spacing.four,
    gap: Spacing.four,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: AppColors.textOnPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  profileInfo: {
    flex: 1,
  },
  greeting: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
  },
  name: {
    color: AppColors.textOnPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  meta: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stat: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: Radius.md,
    paddingVertical: Spacing.two + 4,
    alignItems: 'center',
  },
  statValue: {
    color: AppColors.textOnPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  sectionHeader: {
    marginTop: Spacing.two,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: AppColors.text,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
  },
  filterChipActive: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.neutral,
  },
  filterTextActive: {
    color: AppColors.textOnPrimary,
  },
  separator: {
    height: Spacing.three,
  },
});
