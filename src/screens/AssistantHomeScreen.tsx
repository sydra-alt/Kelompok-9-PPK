import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { EmptyState } from '@/components/EmptyState';
import { SessionCard } from '@/components/SessionCard';
import { AppColors, Radius } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';
import { useAssistantStore } from '@/data/assistant-store';
import { getUserById } from '@/data/users';
import { navigateTo } from '@/navigation/AppNavigator';
import type { SessionStatus } from '@/types';
import { getInitials } from '@/utils/format';

type Filter = 'all' | SessionStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'open', label: 'Dibuka' },
  { value: 'upcoming', label: 'Akan Datang' },
  { value: 'closed', label: 'Selesai' },
];

/** FR-02/04 — Beranda asisten, daftar jadwal, dan pintu masuk pengelolaan sesi. */
export default function AssistantHomeScreen() {
  const { assistantId } = useLocalSearchParams<{ assistantId: string }>();
  const assistant = getUserById(assistantId);
  const { sessions, attendance } = useAssistantStore();
  const [filter, setFilter] = useState<Filter>('all');

  const assignedSessions = useMemo(
    () =>
      assistant?.role === 'assistant'
        ? sessions
            .filter((session) => session.assistantName === assistant.name)
            .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
        : [],
    [assistant, sessions],
  );
  const filteredSessions =
    filter === 'all' ? assignedSessions : assignedSessions.filter((session) => session.status === filter);

  if (!assistant || assistant.role !== 'assistant') {
    return (
      <EmptyState
        icon="🔎"
        title="Identitas asisten tidak ditemukan"
        message="Pilih identitas asisten yang valid untuk melihat jadwal dan mengelola sesi."
        actionLabel="Pilih Identitas"
        onAction={navigateTo.roleSelection}
      />
    );
  }

  const openCount = assignedSessions.filter((session) => session.status === 'open').length;
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const todayCount = assignedSessions.filter((session) => session.date === todayKey).length;

  return (
    <>
      <FlatList
        data={filteredSessions}
        keyExtractor={(session) => session.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.profileCard}>
              <View style={styles.profileRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getInitials(assistant.name)}</Text>
                </View>
                <View style={styles.profileInfo}>
                  <Text style={styles.greeting}>Halo, Asisten</Text>
                  <Text style={styles.name}>{assistant.name}</Text>
                  <Text style={styles.meta}>{assistant.identifier} · {assistant.className}</Text>
                </View>
              </View>
              <View style={styles.statsRow}>
                <Stat label="Jadwal Hari Ini" value={todayCount} />
                <Stat label="Sesi Dibuka" value={openCount} />
                <Stat label="Total Sesi" value={assignedSessions.length} />
              </View>
            </View>

            <AppButton
              testID="open-attendance-recap"
              title="Lihat Rekap Kehadiran"
              variant="secondary"
              onPress={() => navigateTo.assistantRecap(assistant.id)}
            />

            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Jadwal Praktikum</Text>
                <Text style={styles.sectionSubtitle}>Pilih sesi untuk melihat detail dan mengelolanya.</Text>
              </View>
            </View>

            <View style={styles.filterRow}>
              {FILTERS.map((item) => {
                const active = filter === item.value;
                return (
                  <Pressable
                    key={item.value}
                    testID={`assistant-filter-${item.value}`}
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
            testID={`assistant-session-${item.id}`}
            session={item}
            footer={
              <View style={styles.attendanceFooter}>
                <Text style={styles.attendanceCount}>
                  {attendance.filter((record) => record.sessionId === item.id).length} praktikan hadir
                </Text>
                <Text style={styles.detailHint}>Detail & kelola ›</Text>
              </View>
            }
            onPress={() => navigateTo.assistantSession(assistant.id, item.id)}
          />
        )}
        ListEmptyComponent={
          assignedSessions.length === 0 ? (
            <EmptyState
              icon="🗓️"
              title="Belum ada jadwal"
              message={`Belum ada sesi yang ditugaskan kepada ${assistant.name}.`}
            />
          ) : (
            <EmptyState
              icon="🔎"
              title="Tidak ada sesi"
              message="Tidak ada sesi dengan status ini. Coba filter yang lain."
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
  header: { gap: Spacing.three, marginBottom: Spacing.three },
  profileCard: {
    backgroundColor: AppColors.primary,
    experimental_backgroundImage: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
    borderRadius: Radius.xl,
    padding: Spacing.four,
    gap: Spacing.four,
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: AppColors.textOnPrimary, fontSize: 20, fontWeight: '800' },
  profileInfo: { flex: 1 },
  greeting: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  name: { color: AppColors.textOnPrimary, fontSize: 20, fontWeight: '800' },
  meta: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: Spacing.two },
  stat: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: Radius.md,
    paddingVertical: Spacing.two + 4,
    alignItems: 'center',
  },
  statValue: { color: AppColors.textOnPrimary, fontSize: 20, fontWeight: '800' },
  statLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '600', marginTop: 2, textAlign: 'center' },
  sectionHeader: { marginTop: Spacing.two },
  sectionTitle: { color: AppColors.text, fontSize: 18, fontWeight: '800' },
  sectionSubtitle: { color: AppColors.textMuted, fontSize: 13, marginTop: 3 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
  },
  filterChipActive: { backgroundColor: AppColors.primary, borderColor: AppColors.primary },
  filterText: { color: AppColors.neutral, fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: AppColors.textOnPrimary },
  separator: { height: Spacing.three },
  attendanceFooter: {
    borderTopWidth: 1,
    borderTopColor: AppColors.border,
    paddingTop: Spacing.two + 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attendanceCount: { color: AppColors.textMuted, fontSize: 12, fontWeight: '600' },
  detailHint: { color: AppColors.primary, fontSize: 12, fontWeight: '700' },
});
