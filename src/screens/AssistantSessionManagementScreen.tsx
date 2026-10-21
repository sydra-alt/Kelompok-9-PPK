import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { ConfirmActionModal } from '@/components/ConfirmActionModal';
import { EmptyState } from '@/components/EmptyState';
import { FeedbackBanner } from '@/components/FeedbackBanner';
import { StatusBadge } from '@/components/StatusBadge';
import { AppColors, CardShadow, Radius } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';
import { useAssistantStore } from '@/data/assistant-store';
import { getUserById } from '@/data/users';
import { navigateTo } from '@/navigation/AppNavigator';
import type { SessionStatus } from '@/types';
import { formatDate, formatTimeRange } from '@/utils/format';

type PendingAction = 'open' | 'close';

/** FR-03/04 — Detail sesi, konfirmasi, pengelolaan status, dan ringkasan hadir. */
export default function AssistantSessionManagementScreen() {
  const { assistantId, sessionId } = useLocalSearchParams<{ assistantId: string; sessionId: string }>();
  const assistant = getUserById(assistantId);
  const { sessions, attendance, setSessionStatus } = useAssistantStore();
  const session = sessions.find((item) => item.id === sessionId);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const records = attendance.filter((record) => record.sessionId === sessionId);

  if (!assistant || assistant.role !== 'assistant' || !session || session.assistantName !== assistant.name) {
    return (
      <EmptyState
        icon="🔎"
        title="Sesi tidak ditemukan"
        message="Sesi ini tidak tersedia untuk identitas asisten yang dipilih."
        actionLabel="Kembali ke Jadwal"
        onAction={() => navigateTo.assistantHome(assistantId)}
      />
    );
  }

  const action = session.status === 'open' ? 'close' : 'open';
  const canChangeStatus = session.status !== 'closed';

  function confirmAction() {
    if (!session || !pendingAction) return;
    const nextStatus: SessionStatus = pendingAction === 'open' ? 'open' : 'closed';
    setSessionStatus(session.id, nextStatus);
    setFeedback(pendingAction === 'open' ? 'Sesi berhasil dibuka. Praktikan dapat melakukan presensi.' : 'Sesi berhasil ditutup. Presensi untuk sesi ini dinonaktifkan.');
    setPendingAction(null);
  }

  return (
    <>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>PENGELOLAAN SESI</Text>
          <Text style={styles.title}>{session.practicalName}</Text>
          <View style={styles.heroMeta}><Text style={styles.className}>{session.className}</Text><StatusBadge status={session.status} /></View>
        </View>

        {feedback ? (
          <FeedbackBanner
            type="success"
            title="Status sesi diperbarui"
            message={feedback}
            onClose={() => setFeedback(null)}
            testID="session-status-feedback"
          />
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Informasi sesi</Text>
          <InfoRow label="Tanggal" value={formatDate(session.date)} />
          <InfoRow label="Waktu" value={formatTimeRange(session.startTime, session.endTime)} />
          <InfoRow label="Lokasi" value={session.room ?? 'Belum ditentukan'} />
          <InfoRow label="Topik" value={session.topic ?? 'Belum ditentukan'} last />
        </View>

        <View style={styles.attendanceCard}>
          <View style={styles.attendanceHeader}>
            <View>
              <Text style={styles.cardTitle}>Rekap sementara</Text>
              <Text style={styles.muted}>Data dummy kehadiran sesi ini</Text>
            </View>
            <View style={styles.countBadge}><Text style={styles.count}>{records.length}</Text><Text style={styles.countLabel}>hadir</Text></View>
          </View>
          {records.length ? records.map((record) => (
            <View key={record.id} style={styles.attendanceRow}>
              <View style={styles.studentAvatar}><Text style={styles.studentInitial}>{record.studentName.split(' ').map((part) => part[0]).slice(0, 2).join('')}</Text></View>
              <View style={styles.studentInfo}><Text style={styles.studentName}>{record.studentName}</Text><Text style={styles.studentId}>NIM {record.studentId}</Text></View>
              <Text style={styles.time}>{record.attendanceTime.split('T')[1]?.slice(0, 5) ?? '—'}</Text>
            </View>
          )) : <Text style={styles.emptyAttendance}>Belum ada praktikan yang tercatat hadir.</Text>}
          <AppButton
            title="Buka Rekap Kehadiran"
            variant="ghost"
            onPress={() => navigateTo.assistantRecap(assistant.id, session.id)}
            style={styles.recapButton}
          />
        </View>

        <View style={styles.actionArea}>
          <Text style={styles.actionTitle}>Aksi sesi</Text>
          <Text style={styles.actionDescription}>
            {session.status === 'open'
              ? 'Tutup sesi setelah praktikum selesai.'
              : session.status === 'closed'
                ? 'Sesi sudah selesai dan tidak dapat dibuka kembali.'
                : 'Buka sesi saat praktikum dimulai agar presensi tersedia.'}
          </Text>
          <AppButton
            testID="assistant-session-action"
            title={session.status === 'open' ? 'Tutup Sesi' : session.status === 'closed' ? 'Sesi Sudah Selesai' : 'Buka Sesi'}
            onPress={() => setPendingAction(action)}
            disabled={!canChangeStatus}
          />
        </View>
      </ScrollView>

      <ConfirmActionModal
        visible={pendingAction !== null}
        action={pendingAction ?? 'open'}
        sessionName={`${session.practicalName} (${session.className})`}
        onCancel={() => setPendingAction(null)}
        onConfirm={confirmAction}
      />
    </>
  );
}

function InfoRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.three },
  hero: { backgroundColor: AppColors.primary, borderRadius: Radius.xl, padding: Spacing.four, gap: Spacing.two },
  eyebrow: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: AppColors.textOnPrimary, fontSize: 23, lineHeight: 29, fontWeight: '800' },
  heroMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.one },
  className: { color: AppColors.textOnPrimary, fontSize: 14, fontWeight: '700' },
  card: { backgroundColor: AppColors.surface, borderRadius: Radius.lg, padding: Spacing.four, borderWidth: 1, borderColor: AppColors.border, ...CardShadow },
  cardTitle: { color: AppColors.text, fontSize: 16, fontWeight: '800', marginBottom: Spacing.two },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three, paddingVertical: Spacing.two + 2, borderBottomWidth: 1, borderBottomColor: AppColors.border },
  infoRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  infoLabel: { color: AppColors.textMuted, fontSize: 13 },
  infoValue: { flex: 1, textAlign: 'right', color: AppColors.text, fontSize: 13, fontWeight: '600' },
  attendanceCard: { backgroundColor: AppColors.surface, borderRadius: Radius.lg, padding: Spacing.four, borderWidth: 1, borderColor: AppColors.border, ...CardShadow },
  attendanceHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.two },
  muted: { color: AppColors.textMuted, fontSize: 12, marginTop: -Spacing.two },
  countBadge: { minWidth: 56, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, borderRadius: Radius.md, backgroundColor: AppColors.primarySoft, alignItems: 'center' },
  count: { color: AppColors.primary, fontSize: 17, fontWeight: '800' },
  countLabel: { color: AppColors.primary, fontSize: 10, fontWeight: '700' },
  attendanceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.two + 2, borderTopWidth: 1, borderTopColor: AppColors.border, gap: Spacing.two + 4 },
  studentAvatar: { width: 38, height: 38, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: AppColors.primarySoft },
  studentInitial: { color: AppColors.primary, fontSize: 12, fontWeight: '800' },
  studentInfo: { flex: 1 },
  studentName: { color: AppColors.text, fontSize: 13, fontWeight: '700' },
  studentId: { color: AppColors.textMuted, fontSize: 11, marginTop: 2 },
  time: { color: AppColors.success, fontSize: 13, fontWeight: '700' },
  emptyAttendance: { color: AppColors.textMuted, borderTopWidth: 1, borderTopColor: AppColors.border, paddingTop: Spacing.three, fontSize: 13 },
  recapButton: { marginTop: Spacing.two },
  actionArea: { backgroundColor: AppColors.surface, borderRadius: Radius.lg, padding: Spacing.four, borderWidth: 1, borderColor: AppColors.border },
  actionTitle: { color: AppColors.text, fontSize: 16, fontWeight: '800' },
  actionDescription: { color: AppColors.textMuted, fontSize: 13, lineHeight: 19, marginTop: Spacing.one, marginBottom: Spacing.three },
});
