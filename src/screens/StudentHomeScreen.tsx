import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { EmptyState } from '@/components/EmptyState';
import { LoadingState } from '@/components/LoadingState';
import { SessionCard } from '@/components/SessionCard';
import { AppColors, CardShadow, HeroGradient, Radius } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useStudentData } from '@/context/StudentDataContext';
import { navigateTo } from '@/navigation/AppNavigator';
import type { SessionStatus } from '@/types';
import { getInitials } from '@/utils/format';

type Filter = 'all' | SessionStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'open', label: 'Dibuka' },
  { value: 'scheduled', label: 'Terjadwal' },
  { value: 'closed', label: 'Ditutup' },
];

/**
 * FR-02 (Sprint 2) — Beranda praktikan, kelas yang diikuti, jadwal real-time,
 * serta navigasi ke riwayat kehadiran & daftar pengajuan izin.
 */
export default function StudentHomeScreen() {
  const { profile, logout } = useAuth();
  const {
    memberships,
    classes,
    classParticipants,
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

  const [filter, setFilter] = useState<Filter>('all');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');

  const attendedIds = useMemo(() => new Set(attendance.map((r) => r.sessionId)), [attendance]);
  const permissionBySession = useMemo(
    () => new Map(permissionRequests.map((req) => [req.sessionId, req])),
    [permissionRequests],
  );

  const participantCountByClass = useMemo(() => {
    const counts = new Map<string, number>();
    for (const member of classParticipants) {
      counts.set(member.classId, (counts.get(member.classId) ?? 0) + 1);
    }
    return counts;
  }, [classParticipants]);

  const filteredSessions = useMemo(
    () =>
      sessions.filter((session) => {
        const matchStatus = filter === 'all' || session.status === filter;
        const matchClass = selectedClassId === 'all' || session.classId === selectedClassId;
        return matchStatus && matchClass;
      }),
    [sessions, filter, selectedClassId],
  );

  if (!profile || profile.role !== 'praktikan') {
    return (
      <EmptyState
        icon="🔍"
        title="Akses Praktikan Diperlukan"
        message="Silakan masuk menggunakan akun praktikan untuk melihat jadwal praktikum."
        actionLabel="Kembali ke Login"
        onAction={navigateTo.roleSelection}
      />
    );
  }

  if (loading && sessions.length === 0 && memberships.length === 0) {
    return (
      <LoadingState
        title="Memuat beranda praktikan..."
        message="Mengambil data kelas, jadwal sesi, dan presensi dari Firestore."
      />
    );
  }

  if (error && sessions.length === 0 && memberships.length === 0) {
    return (
      <EmptyState
        icon="⚠️"
        title="Gagal memuat data praktikan"
        message={error}
        actionLabel="Coba Lagi"
        onAction={retry}
      />
    );
  }

  const openCount = sessions.filter((s) => s.status === 'open').length;
  const pendingPermissionCount = permissionRequests.filter((p) => p.status === 'pending').length;

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
            <ConnectionBanner
              isOffline={isOffline}
              fromCache={fromCache}
              error={error}
              onRetry={retry}
            />

            <View style={styles.profileCard}>
              <View style={styles.profileRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getInitials(profile.name)}</Text>
                </View>
                <View style={styles.profileInfo}>
                  <Text style={styles.greeting}>Halo, Praktikan</Text>
                  <Text style={styles.name}>{profile.name}</Text>
                  <Text style={styles.meta}>
                    {profile.identifier} • {classNamesLabel}
                  </Text>
                </View>
                <Pressable
                  testID="student-logout-button"
                  onPress={() => void logout()}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}>
                  <Text style={styles.logoutText}>Keluar</Text>
                </Pressable>
              </View>

              <View style={styles.statsRow}>
                <Stat label="Total Sesi" value={sessions.length} />
                <Stat label="Dibuka" value={openCount} />
                <Stat label="Hadir" value={attendance.length} />
                <Stat label="Izin" value={permissionRequests.length} />
              </View>
            </View>

            {memberships.length > 0 ? (
              <View style={styles.classesCard}>
                <View style={styles.classesHeader}>
                  <Text style={styles.classesTitle}>Kelas Praktikum Diikuti</Text>
                  <Text style={styles.classesCount}>{memberships.length} kelas</Text>
                </View>
                <View style={styles.classChipRow}>
                  {memberships.length > 1 ? (
                    <Pressable
                      onPress={() => setSelectedClassId('all')}
                      style={[
                        styles.classChip,
                        selectedClassId === 'all' && styles.classChipActive,
                      ]}>
                      <Text
                        style={[
                          styles.classChipTitle,
                          selectedClassId === 'all' && styles.classChipTitleActive,
                        ]}>
                        Semua Kelas
                      </Text>
                    </Pressable>
                  ) : null}
                  {memberships.map((m) => {
                    const cls = classes.find((c) => c.id === m.classId);
                    const count = participantCountByClass.get(m.classId) ?? 1;
                    const active = selectedClassId === m.classId;
                    return (
                      <Pressable
                        key={m.id}
                        onPress={() =>
                          setSelectedClassId((prev) => (prev === m.classId ? 'all' : m.classId))
                        }
                        style={[styles.classChip, active && styles.classChipActive]}>
                        <Text style={[styles.classChipTitle, active && styles.classChipTitleActive]}>
                          {m.className}
                          {cls?.practicalName ? ` • ${cls.practicalName}` : ''}
                        </Text>
                        <Text style={[styles.classChipMeta, active && styles.classChipMetaActive]}>
                          👥 {count} peserta
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View style={styles.actionRow}>
              <AppButton
                testID="open-history-button"
                title="📋 Riwayat Kehadiran"
                variant="secondary"
                onPress={() => navigateTo.studentHistory(profile.uid)}
                style={styles.actionButton}
              />
              <AppButton
                testID="open-permissions-button"
                title={
                  pendingPermissionCount > 0
                    ? `📝 Izin (${pendingPermissionCount} menunggu)`
                    : '📝 Pengajuan Izin'
                }
                variant="secondary"
                onPress={navigateTo.studentPermissions}
                style={styles.actionButton}
              />
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Jadwal Praktikum</Text>
              <Text style={styles.realtimeBadge}>● Sinkron Real-Time</Text>
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
                    <Text style={[styles.filterText, active && styles.filterTextActive]}>
                      {item.label}
                    </Text>
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
            permissionStatus={permissionBySession.get(item.id)?.status}
            onPress={() => navigateTo.studentSessionDetail(profile.uid, item.id)}
          />
        )}
        ListEmptyComponent={
          memberships.length === 0 ? (
            <EmptyState
              icon="🏫"
              title="Belum terdaftar di kelas"
              message="Akun praktikanmu belum dimasukkan ke kelas praktikum mana pun. Hubungi asisten untuk ditambahkan ke kelasmu."
              actionLabel="Muat Ulang"
              onAction={retry}
            />
          ) : sessions.length === 0 ? (
            <EmptyState
              icon="📭"
              title="Belum ada jadwal"
              message={`Belum ada jadwal sesi praktikum untuk kelas ${classNamesLabel}.`}
              actionLabel="Muat Ulang"
              onAction={retry}
            />
          ) : (
            <EmptyState
              icon="🔎"
              title="Tidak ada sesi"
              message="Tidak ada sesi dengan filter ini. Coba pilih filter lain."
              actionLabel="Tampilkan Semua"
              onAction={() => {
                setFilter('all');
                setSelectedClassId('all');
              }}
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
    width: 52,
    height: 52,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: AppColors.textOnPrimary,
    fontSize: 19,
    fontWeight: '800',
  },
  profileInfo: {
    flex: 1,
  },
  greeting: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
  },
  name: {
    color: AppColors.textOnPrimary,
    fontSize: 19,
    fontWeight: '800',
  },
  meta: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginTop: 2,
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  logoutText: {
    color: AppColors.textOnPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stat: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: Radius.md,
    paddingVertical: Spacing.two + 2,
    alignItems: 'center',
  },
  statValue: {
    color: AppColors.textOnPrimary,
    fontSize: 19,
    fontWeight: '800',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  classesCard: {
    backgroundColor: AppColors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: Spacing.three,
    gap: Spacing.two,
    ...CardShadow,
  },
  classesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  classesTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.text,
  },
  classesCount: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.textMuted,
  },
  classChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  classChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: AppColors.background,
    borderWidth: 1,
    borderColor: AppColors.border,
    gap: 2,
  },
  classChipActive: {
    backgroundColor: AppColors.primarySoft,
    borderColor: AppColors.primary,
  },
  classChipTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.text,
  },
  classChipTitleActive: {
    color: AppColors.primaryDark,
  },
  classChipMeta: {
    fontSize: 11,
    color: AppColors.textMuted,
  },
  classChipMetaActive: {
    color: AppColors.primaryDark,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionButton: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: AppColors.text,
  },
  realtimeBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.success,
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
