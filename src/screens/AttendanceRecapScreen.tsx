import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { AppColors, CardShadow, Radius } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';
import { useAssistantStore } from '@/data/assistant-store';
import { getUserById } from '@/data/users';
import { navigateTo } from '@/navigation/AppNavigator';
import { formatClock, formatDate, formatTimeRange } from '@/utils/format';

/** FR-06 — Rekap mandiri asisten dengan empty state per sesi. */
export default function AttendanceRecapScreen() {
  const { assistantId, sessionId: requestedSessionId } = useLocalSearchParams<{
    assistantId: string;
    sessionId?: string;
  }>();
  const assistant = getUserById(assistantId);
  const { sessions, attendance } = useAssistantStore();
  const assignedSessions = useMemo(
    () =>
      assistant?.role === 'assistant'
        ? sessions
            .filter((session) => session.assistantName === assistant.name)
            .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
        : [],
    [assistant, sessions],
  );
  const [selectedId, setSelectedId] = useState(requestedSessionId ?? '');
  const effectiveId = assignedSessions.some((session) => session.id === selectedId)
    ? selectedId
    : assignedSessions.find((session) => session.id === requestedSessionId)?.id ?? assignedSessions[0]?.id ?? '';
  const selectedSession = assignedSessions.find((session) => session.id === effectiveId);
  const records = attendance.filter((record) => record.sessionId === effectiveId);

  if (!assistant || assistant.role !== 'assistant') {
    return (
      <EmptyState
        icon="🔎"
        title="Identitas asisten tidak ditemukan"
        message="Pilih identitas asisten yang valid untuk melihat rekap kehadiran."
        actionLabel="Pilih Identitas"
        onAction={navigateTo.roleSelection}
      />
    );
  }

  if (!assignedSessions.length) {
    return <EmptyState icon="📋" title="Belum ada rekap" message="Belum ada sesi yang ditugaskan kepada Anda." />;
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>RUANG ASISTEN</Text>
        <Text style={styles.title}>Rekap Kehadiran</Text>
        <Text style={styles.subtitle}>Daftar praktikan yang sudah tercatat hadir.</Text>
      </View>

      <Text style={styles.sectionLabel}>Pilih sesi praktikum</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sessionPicker}>
        {assignedSessions.map((session) => {
          const selected = session.id === effectiveId;
          return (
            <Pressable
              key={session.id}
              onPress={() => setSelectedId(session.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={[styles.sessionChoice, selected && styles.sessionChoiceSelected]}>
              <Text style={[styles.choiceClass, selected && styles.choiceTextSelected]}>{session.className}</Text>
              <Text numberOfLines={1} style={[styles.choiceName, selected && styles.choiceTextSelected]}>{session.practicalName}</Text>
              <Text style={[styles.choiceDate, selected && styles.choiceTextSelected]}>{formatDate(session.date)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {selectedSession ? <>
        <View style={styles.sessionCard}>
          <View style={styles.sessionHeader}>
            <View style={styles.sessionText}>
              <Text style={styles.sessionName}>{selectedSession.practicalName}</Text>
              <Text style={styles.sessionMeta}>{selectedSession.className} · {formatDate(selectedSession.date)}</Text>
              <Text style={styles.sessionMeta}>{formatTimeRange(selectedSession.startTime, selectedSession.endTime)} · {selectedSession.room ?? 'Lokasi belum ditentukan'}</Text>
            </View>
            <StatusBadge status={selectedSession.status} />
          </View>
          <View style={styles.totalRow}>
            <View><Text style={styles.totalLabel}>Total praktikan hadir</Text><Text style={styles.totalValue}>{records.length} <Text style={styles.totalUnit}>orang</Text></Text></View>
            <View style={styles.totalIcon}><Text style={styles.totalIconText}>✓</Text></View>
          </View>
        </View>

        <View style={styles.listHeading}>
          <Text style={styles.listTitle}>Daftar Kehadiran</Text>
          <Text style={styles.listCount}>{records.length} orang</Text>
        </View>

        {records.length ? (
          <View style={styles.recordsCard}>
            {records.map((record, index) => (
              <View key={record.id} style={[styles.recordRow, index === records.length - 1 && styles.lastRecordRow]}>
                <View style={styles.indexBadge}><Text style={styles.indexText}>{String(index + 1).padStart(2, '0')}</Text></View>
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{record.studentName}</Text>
                  <Text style={styles.studentId}>NIM {record.studentId}</Text>
                </View>
                <View style={styles.timeColumn}>
                  <Text style={styles.timeValue}>{formatClock(record.attendanceTime)}</Text>
                  <Text style={styles.timeLabel}>Waktu hadir</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <EmptyState
              icon="◷"
              title="Belum ada presensi"
              message="Daftar praktikan yang hadir akan muncul di sini setelah presensi tercatat."
            />
          </View>
        )}
        <View style={styles.note}><Text style={styles.noteIcon}>i</Text><Text style={styles.noteText}>Rekap menggunakan data dummy dan berdiri sendiri dari catatan praktikan.</Text></View>
      </> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: Spacing.three, paddingBottom: Spacing.six },
  heading: { marginBottom: Spacing.four },
  eyebrow: { color: AppColors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginBottom: Spacing.one + 2 },
  title: { color: AppColors.text, fontSize: 25, fontWeight: '800' },
  subtitle: { color: AppColors.textMuted, fontSize: 14, marginTop: Spacing.one },
  sectionLabel: { color: AppColors.text, fontSize: 13, fontWeight: '700', marginBottom: Spacing.two },
  sessionPicker: { gap: Spacing.two, paddingBottom: Spacing.three },
  sessionChoice: { width: 168, padding: Spacing.three, borderWidth: 1, borderColor: AppColors.border, borderRadius: Radius.lg, backgroundColor: AppColors.surface },
  sessionChoiceSelected: { backgroundColor: AppColors.primary, borderColor: AppColors.primary },
  choiceClass: { color: AppColors.primary, fontSize: 11, fontWeight: '800' },
  choiceName: { color: AppColors.text, fontSize: 13, fontWeight: '700', marginTop: Spacing.one },
  choiceDate: { color: AppColors.textMuted, fontSize: 11, marginTop: Spacing.one },
  choiceTextSelected: { color: AppColors.textOnPrimary },
  sessionCard: { padding: Spacing.three, borderWidth: 1, borderColor: AppColors.border, borderRadius: Radius.lg, backgroundColor: AppColors.surface, ...CardShadow },
  sessionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.two },
  sessionText: { flex: 1 },
  sessionName: { color: AppColors.text, fontSize: 15, fontWeight: '800' },
  sessionMeta: { color: AppColors.textMuted, fontSize: 11, marginTop: Spacing.one },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: AppColors.border, marginTop: Spacing.three, paddingTop: Spacing.three },
  totalLabel: { color: AppColors.textMuted, fontSize: 12 },
  totalValue: { color: AppColors.primary, fontSize: 23, fontWeight: '800', marginTop: 2 },
  totalUnit: { color: AppColors.textMuted, fontSize: 12, fontWeight: '500' },
  totalIcon: { width: 38, height: 38, borderRadius: Radius.pill, backgroundColor: AppColors.successSoft, alignItems: 'center', justifyContent: 'center' },
  totalIconText: { color: AppColors.success, fontSize: 19, fontWeight: '800' },
  listHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.four, marginBottom: Spacing.two },
  listTitle: { color: AppColors.text, fontSize: 17, fontWeight: '800' },
  listCount: { color: AppColors.textMuted, fontSize: 12 },
  recordsCard: { paddingHorizontal: Spacing.three, borderWidth: 1, borderColor: AppColors.border, borderRadius: Radius.lg, backgroundColor: AppColors.surface, ...CardShadow },
  recordRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: Spacing.two + 4, borderBottomWidth: 1, borderBottomColor: AppColors.border },
  lastRecordRow: { borderBottomWidth: 0 },
  indexBadge: { width: 34, height: 34, borderRadius: Radius.md, backgroundColor: AppColors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  indexText: { color: AppColors.primary, fontSize: 11, fontWeight: '800' },
  studentInfo: { flex: 1 },
  studentName: { color: AppColors.text, fontSize: 13, fontWeight: '700' },
  studentId: { color: AppColors.textMuted, fontSize: 11, marginTop: 3 },
  timeColumn: { alignItems: 'flex-end' },
  timeValue: { color: AppColors.success, fontSize: 13, fontWeight: '800' },
  timeLabel: { color: AppColors.textMuted, fontSize: 10, marginTop: 3 },
  emptyCard: { borderWidth: 1, borderColor: AppColors.border, borderRadius: Radius.lg, backgroundColor: AppColors.surface },
  note: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three, marginTop: Spacing.three, backgroundColor: AppColors.primarySoft, borderRadius: Radius.md },
  noteIcon: { width: 20, height: 20, textAlign: 'center', textAlignVertical: 'center', borderRadius: Radius.pill, overflow: 'hidden', color: AppColors.primary, backgroundColor: 'rgba(79,70,229,0.12)', fontSize: 12, fontWeight: '800' },
  noteText: { flex: 1, color: AppColors.neutral, fontSize: 11, lineHeight: 16 },
});
