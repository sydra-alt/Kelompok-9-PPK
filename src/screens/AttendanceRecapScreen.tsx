import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ConnectionBanner } from '@/components/ConnectionBanner';
import { EmptyState } from '@/components/EmptyState';
import { LoadingState } from '@/components/LoadingState';
import { StatusBadge } from '@/components/StatusBadge';
import { AppColors, CardShadow, Radius } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';
import { useAssistantData } from '@/context/AssistantDataContext';
import { useAuth } from '@/context/AuthContext';
import { getUserById } from '@/data/users';
import { navigateTo } from '@/navigation/AppNavigator';
import { formatClock, formatDate, formatTimeRange } from '@/utils/format';

/**
 * FR-06 & Sprint 2 — Rekap presensi mandiri asisten berbasis Cloud Firestore real-time.
 * Menampilkan identitas praktikan, sesi praktikum, tanggal, dan waktu presensi.
 */
export default function AttendanceRecapScreen() {
  const { assistantId, sessionId: requestedSessionId } = useLocalSearchParams<{
    assistantId: string;
    sessionId?: string;
  }>();

  const { profile } = useAuth();
  const dummyAssistant = getUserById(assistantId);
  const assistantName = profile?.name ?? dummyAssistant?.name ?? 'Asisten';

  const {
    labs,
    sessions,
    attendance,
    loading,
    error,
    fromCache,
    isOffline,
    retry,
  } = useAssistantData();

  const assignedSessions = useMemo(
    () =>
      sessions.slice().sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)),
    [sessions],
  );

  const [selectedId, setSelectedId] = useState(requestedSessionId ?? '');

  const effectiveId = assignedSessions.some((session) => session.id === selectedId)
    ? selectedId
    : assignedSessions.find((session) => session.id === requestedSessionId)?.id ??
      assignedSessions[0]?.id ??
      '';

  const selectedSession = assignedSessions.find((session) => session.id === effectiveId);
  const selectedLab = selectedSession?.labId
    ? labs.find((lab) => lab.id === selectedSession.labId)
    : undefined;
  const records = attendance.filter((record) => record.sessionId === effectiveId);
  const locationVerifiedCount = records.filter(
    (record) =>
      record.latitude !== undefined &&
      record.longitude !== undefined &&
      record.distanceMeters !== undefined,
  ).length;

  if (loading && assignedSessions.length === 0) {
    return <LoadingState title="Memuat rekap kehadiran..." />;
  }

  if (!assignedSessions.length) {
    return (
      <View style={styles.content}>
        <EmptyState
          icon="📋"
          title="Belum ada jadwal praktikum"
          message={`Belum ada sesi praktikum yang tersedia untuk direkap.`}
          actionLabel="Kembali ke Dashboard"
          onAction={() => navigateTo.assistantHome(assistantId)}
        />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>RUANG ASISTEN</Text>
        <Text style={styles.title}>Rekap Presensi Praktikum</Text>
        <Text style={styles.subtitle}>
          Daftar praktikan hadir untuk kelas asisten {assistantName} tersinkronisasi langsung dari
          Cloud Firestore secara real-time.
        </Text>
      </View>

      <ConnectionBanner
        isOffline={isOffline}
        fromCache={fromCache}
        error={error}
        onRetry={retry}
      />

      <Text style={styles.sectionLabel}>Pilih Sesi Praktikum</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sessionPicker}>
        {assignedSessions.map((session) => {
          const selected = session.id === effectiveId;
          const sessionRecordsCount = attendance.filter((a) => a.sessionId === session.id).length;
          return (
            <Pressable
              key={session.id}
              onPress={() => setSelectedId(session.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={[styles.sessionChoice, selected && styles.sessionChoiceSelected]}>
              <View style={styles.choiceHeaderRow}>
                <Text style={[styles.choiceClass, selected && styles.choiceTextSelected]}>
                  {session.className}
                </Text>
                <Text style={[styles.choiceBadge, selected && styles.choiceBadgeSelected]}>
                  {sessionRecordsCount} hadir
                </Text>
              </View>
              <Text
                numberOfLines={1}
                style={[styles.choiceName, selected && styles.choiceTextSelected]}>
                {session.practicalName}
              </Text>
              <Text style={[styles.choiceDate, selected && styles.choiceTextSelected]}>
                {formatDate(session.date)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {selectedSession ? (
        <>
          <View style={styles.sessionCard}>
            <View style={styles.sessionHeader}>
              <View style={styles.sessionText}>
                <Text style={styles.sessionName}>{selectedSession.practicalName}</Text>
                <Text style={styles.sessionMeta}>
                  {selectedSession.className} • {formatDate(selectedSession.date)}
                </Text>
                <Text style={styles.sessionMeta}>
                  {formatTimeRange(selectedSession.startTime, selectedSession.endTime)} •{' '}
                  {selectedLab?.name ?? selectedSession.labName ?? selectedSession.room ?? 'Lokasi belum ditentukan'}
                  {selectedLab?.building ? ` (${selectedLab.building})` : ''}
                </Text>
                {selectedLab ? (
                  <Text style={styles.sessionLabMeta}>
                    📍 Radius validasi: {selectedLab.radiusMeters} m (
                    {selectedLab.latitude.toFixed(5)}, {selectedLab.longitude.toFixed(5)})
                  </Text>
                ) : null}
                {selectedSession.topic ? (
                  <Text style={styles.sessionTopic}>Topik: {selectedSession.topic}</Text>
                ) : null}
              </View>
              <StatusBadge status={selectedSession.status} />
            </View>

            <View style={styles.totalRow}>
              <View>
                <Text style={styles.totalLabel}>Total praktikan hadir</Text>
                <Text style={styles.totalValue}>
                  {records.length} <Text style={styles.totalUnit}>orang</Text>
                </Text>
                <Text style={styles.locationSummary}>
                  Tervalidasi lokasi: {locationVerifiedCount}/{records.length}
                </Text>
              </View>
              <View style={styles.totalIcon}>
                <Text style={styles.totalIconText}>✓</Text>
              </View>
            </View>
          </View>

          <View style={styles.listHeading}>
            <Text style={styles.listTitle}>Daftar Kehadiran Praktikan</Text>
            <Text style={styles.listCount}>{records.length} praktikan hadir</Text>
          </View>

          {records.length > 0 ? (
            <View style={styles.recordsCard}>
              {records.map((record, index) => {
                const hasLocation =
                  record.latitude !== undefined &&
                  record.longitude !== undefined &&
                  record.distanceMeters !== undefined;
                const isWithinCurrentRadius =
                  hasLocation && selectedLab ? record.distanceMeters! <= selectedLab.radiusMeters : true;
                const datePart = record.attendanceTime.split('T')[0];
                const formattedDate = /^\d{4}-\d{2}-\d{2}$/.test(datePart)
                  ? formatDate(datePart)
                  : '-';

                return (
                  <View
                    key={record.id}
                    style={[
                      styles.recordRow,
                      index === records.length - 1 && styles.lastRecordRow,
                    ]}>
                    <View style={styles.indexBadge}>
                      <Text style={styles.indexText}>{String(index + 1).padStart(2, '0')}</Text>
                    </View>
                    <View style={styles.studentInfo}>
                      <Text style={styles.studentName}>{record.studentName}</Text>
                      <Text style={styles.studentId}>
                        {record.studentIdentifier
                          ? `NIM ${record.studentIdentifier}`
                          : `UID: ${record.studentId}`}
                      </Text>

                      {hasLocation ? (
                        <View style={styles.recordLocationBox}>
                          <View style={styles.recordLocationBadges}>
                            <View style={styles.distanceBadge}>
                              <Text style={styles.distanceBadgeText}>
                                📍 Jarak {Math.round(record.distanceMeters!)} m
                              </Text>
                            </View>
                            <View
                              style={[
                                styles.validBadge,
                                !isWithinCurrentRadius && styles.validBadgeWarning,
                              ]}>
                              <Text
                                style={[
                                  styles.validBadgeText,
                                  !isWithinCurrentRadius && styles.validBadgeTextWarning,
                                ]}>
                                {selectedLab
                                  ? isWithinCurrentRadius
                                    ? `✓ Valid ≤ ${selectedLab.radiusMeters} m`
                                    : '⚠️ Melebihi radius lab saat ini'
                                  : '✓ Lokasi tercatat'}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.coordText}>
                            Koordinat: {record.latitude!.toFixed(5)}, {record.longitude!.toFixed(5)}
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.noLocationText}>Metadata lokasi tidak tersedia</Text>
                      )}
                    </View>
                    <View style={styles.timeColumn}>
                      <Text style={styles.timeValue}>{formatClock(record.attendanceTime)} WIB</Text>
                      <Text style={styles.timeLabel}>{formattedDate}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <EmptyState
                icon="◷"
                title="Belum ada presensi"
                message="Daftar praktikan yang hadir akan muncul di sini secara otomatis saat presensi dilakukan."
              />
            </View>
          )}

          <View style={styles.note}>
            <Text style={styles.noteIcon}>⚡</Text>
            <Text style={styles.noteText}>
              Data presensi disinkronkan secara real-time dari Cloud Firestore. Setiap kali praktikan
              melakukan presensi, daftar di atas langsung diperbarui otomatis tanpa reload.
            </Text>
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  heading: {
    marginBottom: Spacing.two,
  },
  eyebrow: {
    color: AppColors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: Spacing.one,
  },
  title: {
    color: AppColors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: AppColors.textMuted,
    fontSize: 13,
    marginTop: Spacing.one,
    lineHeight: 18,
  },
  sectionLabel: {
    color: AppColors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  sessionPicker: {
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  sessionChoice: {
    width: 180,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: Radius.lg,
    backgroundColor: AppColors.surface,
  },
  sessionChoiceSelected: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  choiceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  choiceClass: {
    color: AppColors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  choiceBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: AppColors.textMuted,
    backgroundColor: AppColors.background,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  choiceBadgeSelected: {
    color: AppColors.textOnPrimary,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  choiceName: {
    color: AppColors.text,
    fontSize: 13,
    fontWeight: '700',
    marginTop: Spacing.one,
  },
  choiceDate: {
    color: AppColors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  choiceTextSelected: {
    color: AppColors.textOnPrimary,
  },
  sessionCard: {
    padding: Spacing.three + 2,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: Radius.lg,
    backgroundColor: AppColors.surface,
    ...CardShadow,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  sessionText: {
    flex: 1,
  },
  sessionName: {
    color: AppColors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  sessionMeta: {
    color: AppColors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  sessionTopic: {
    color: AppColors.primary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  sessionLabMeta: {
    color: AppColors.primaryDark,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: AppColors.border,
    marginTop: Spacing.three,
    paddingTop: Spacing.three,
  },
  totalLabel: {
    color: AppColors.textMuted,
    fontSize: 12,
  },
  totalValue: {
    color: AppColors.primary,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  totalUnit: {
    color: AppColors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  locationSummary: {
    color: AppColors.success,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  totalIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    backgroundColor: AppColors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalIconText: {
    color: AppColors.success,
    fontSize: 18,
    fontWeight: '800',
  },
  listHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
  },
  listTitle: {
    color: AppColors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  listCount: {
    color: AppColors.textMuted,
    fontSize: 12,
  },
  recordsCard: {
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: Radius.lg,
    backgroundColor: AppColors.surface,
    ...CardShadow,
  },
  recordRow: {
    minHeight: 72,
    paddingVertical: Spacing.two + 4,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two + 4,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
  },
  lastRecordRow: {
    borderBottomWidth: 0,
  },
  indexBadge: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    backgroundColor: AppColors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  indexText: {
    color: AppColors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    color: AppColors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  studentId: {
    color: AppColors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  recordLocationBox: {
    marginTop: 6,
    gap: 4,
  },
  recordLocationBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  distanceBadge: {
    backgroundColor: AppColors.primarySoft,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  distanceBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: AppColors.primaryDark,
  },
  validBadge: {
    backgroundColor: AppColors.successSoft,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  validBadgeWarning: {
    backgroundColor: AppColors.warningSoft,
  },
  validBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: AppColors.success,
  },
  validBadgeTextWarning: {
    color: AppColors.warning,
  },
  coordText: {
    fontSize: 10,
    color: AppColors.textMuted,
  },
  noLocationText: {
    fontSize: 11,
    color: AppColors.textMuted,
    fontStyle: 'italic',
    marginTop: 4,
  },
  timeColumn: {
    alignItems: 'flex-end',
  },
  timeValue: {
    color: AppColors.success,
    fontSize: 13,
    fontWeight: '800',
  },
  timeLabel: {
    color: AppColors.textMuted,
    fontSize: 10,
    marginTop: 2,
    textAlign: 'right',
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: Radius.lg,
    backgroundColor: AppColors.surface,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    marginTop: Spacing.two,
    backgroundColor: AppColors.primarySoft,
    borderRadius: Radius.md,
  },
  noteIcon: {
    fontSize: 16,
  },
  noteText: {
    flex: 1,
    color: AppColors.primaryDark,
    fontSize: 11,
    lineHeight: 16,
  },
});
