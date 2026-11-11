import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { ConfirmActionModal } from '@/components/ConfirmActionModal';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { EmptyState } from '@/components/EmptyState';
import { FeedbackBanner } from '@/components/FeedbackBanner';
import { LoadingState } from '@/components/LoadingState';
import { SessionFormModal } from '@/components/SessionFormModal';
import { StatusBadge } from '@/components/StatusBadge';
import { AppColors, CardShadow, Radius } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';
import { useAssistantData } from '@/context/AssistantDataContext';
import { useAuth } from '@/context/AuthContext';
import { getUserById } from '@/data/users';
import { navigateTo } from '@/navigation/AppNavigator';
import { subscribeSession } from '@/services/assistant-data-service';
import type { PracticeSession, SessionStatus } from '@/types';
import { formatClock, formatDate, formatTimeRange } from '@/utils/format';

type PendingAction = 'open' | 'close';

/**
 * Layar manajemen sesi praktikum oleh asisten (PIC: Programmer 2).
 * Menampilkan detail sesi, rekap kehadiran sementara secara real-time dari Firestore,
 * dan kontrol membuka/menutup sesi dengan validasi otoritas asisten.
 */
export default function AssistantSessionManagementScreen() {
  const { assistantId, sessionId } = useLocalSearchParams<{
    assistantId: string;
    sessionId: string;
  }>();

  const { profile } = useAuth();
  const dummyAssistant = getUserById(assistantId);
  const assistantName = profile?.name ?? dummyAssistant?.name ?? 'Asisten';

  const {
    classes,
    sessions,
    attendance,
    setSessionStatus,
    updateSession,
    deleteSession,
  } = useAssistantData();

  // Ambil sesi dari context jika ada, atau dengarkan langsung lewat Firestore
  const contextSession = sessions.find((item) => item.id === sessionId);
  const [directSession, setDirectSession] = useState<PracticeSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(!contextSession);

  useEffect(() => {
    if (!sessionId) return undefined;
    const unsub = subscribeSession(
      sessionId,
      (data) => {
        setDirectSession(data);
        setLoadingSession(false);
      },
      () => {
        setLoadingSession(false);
      },
    );
    return unsub;
  }, [sessionId]);

  const session = contextSession ?? directSession;

  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<'success' | 'error'>('success');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Rekap kehadiran untuk sesi ini dari Firestore real-time
  const records = attendance.filter((record) => record.sessionId === sessionId);

  if (loadingSession) {
    return <LoadingState title="Memuat detail sesi praktikum..." />;
  }

  if (!session) {
    return (
      <EmptyState
        icon="🔎"
        title="Sesi tidak ditemukan"
        message="Sesi ini tidak ditemukan atau sudah dihapus dari sistem."
        actionLabel="Kembali ke Dashboard"
        onAction={() => navigateTo.assistantHome(assistantId)}
      />
    );
  }

  const action = session.status === 'open' ? 'close' : 'open';
  const canChangeStatus = session.status !== 'closed';

  async function confirmAction() {
    if (!session || !pendingAction) return;
    const nextStatus: SessionStatus = pendingAction === 'open' ? 'open' : 'closed';
    try {
      await setSessionStatus(session.id, nextStatus);
      setFeedbackType('success');
      setFeedback(
        pendingAction === 'open'
          ? 'Sesi berhasil dibuka. Praktikan sekarang dapat melakukan presensi secara real-time.'
          : 'Sesi berhasil ditutup. Praktikan tidak dapat lagi melakukan presensi untuk sesi ini.',
      );
    } catch (err: unknown) {
      setFeedbackType('error');
      setFeedback(err instanceof Error ? err.message : 'Gagal mengubah status sesi.');
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDelete() {
    if (!session) return;
    setDeleting(true);
    try {
      await deleteSession(session.id);
      navigateTo.assistantHome(assistantId);
    } catch (err: unknown) {
      setFeedbackType('error');
      setFeedback(err instanceof Error ? err.message : 'Gagal menghapus sesi.');
      setDeleteModalVisible(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>PENGELOLAAN SESI PRAKTIKUM</Text>
          <Text style={styles.title}>{session.practicalName}</Text>
          <View style={styles.heroMeta}>
            <Text style={styles.className}>{session.className}</Text>
            <StatusBadge status={session.status} />
          </View>
        </View>

        {feedback ? (
          <FeedbackBanner
            type={feedbackType}
            title={feedbackType === 'success' ? 'Berhasil' : 'Terjadi Kesalahan'}
            message={feedback}
            onClose={() => setFeedback(null)}
            testID="session-status-feedback"
          />
        ) : null}

        {/* Informasi Sesi & Aksi Edit */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Informasi Sesi</Text>
            <Pressable
              onPress={() => setEditModalVisible(true)}
              style={styles.editButton}
              accessibilityRole="button">
              <Text style={styles.editButtonText}>Edit Sesi</Text>
            </Pressable>
          </View>
          <InfoRow label="Tanggal" value={formatDate(session.date)} />
          <InfoRow label="Waktu" value={formatTimeRange(session.startTime, session.endTime)} />
          <InfoRow label="Lokasi" value={session.room ?? 'Belum ditentukan'} />
          <InfoRow label="Topik" value={session.topic ?? 'Belum ditentukan'} />
          <InfoRow
            label="Asisten Pengampu"
            value={session.assistantName ?? assistantName}
            last
          />
        </View>

        {/* Rekap Kehadiran Real-Time */}
        <View style={styles.attendanceCard}>
          <View style={styles.attendanceHeader}>
            <View>
              <Text style={styles.cardTitle}>Kehadiran Praktikan</Text>
              <Text style={styles.muted}>Tersinkronisasi langsung dari Firestore</Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.count}>{records.length}</Text>
              <Text style={styles.countLabel}>hadir</Text>
            </View>
          </View>

          {records.length > 0 ? (
            records.map((record) => (
              <View key={record.id} style={styles.attendanceRow}>
                <View style={styles.studentAvatar}>
                  <Text style={styles.studentInitial}>
                    {record.studentName
                      .split(' ')
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join('')}
                  </Text>
                </View>
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{record.studentName}</Text>
                  <Text style={styles.studentId}>
                    {record.studentIdentifier ? `NIM ${record.studentIdentifier}` : record.studentId}
                  </Text>
                </View>
                <Text style={styles.time}>{formatClock(record.attendanceTime)} WIB</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyAttendance}>
              Belum ada praktikan yang tercatat hadir pada sesi ini.
            </Text>
          )}

          <AppButton
            title="Buka Rekap Kehadiran Lengkap"
            variant="ghost"
            onPress={() => navigateTo.assistantRecap(assistantId, session.id)}
            style={styles.recapButton}
          />
        </View>

        {/* Kontrol Buka / Tutup Sesi */}
        <View style={styles.actionArea}>
          <Text style={styles.actionTitle}>Status & Kontrol Sesi</Text>
          <Text style={styles.actionDescription}>
            {session.status === 'open'
              ? 'Sesi saat ini sedang DIBUKA. Praktikan di kelas dapat melakukan presensi mandiri. Tutup sesi setelah praktikum selesai.'
              : session.status === 'closed'
                ? 'Sesi sudah SELESAI DITUTUP. Presensi untuk sesi ini telah dinonaktifkan secara permanen.'
                : 'Sesi saat ini BELUM DIBUKA. Buka sesi saat praktikum dimulai agar tombol presensi aktif di aplikasi praktikan.'}
          </Text>

          <AppButton
            testID="assistant-session-action"
            title={
              session.status === 'open'
                ? 'Tutup Sesi Praktikum'
                : session.status === 'closed'
                  ? 'Sesi Sudah Ditutup'
                  : 'Buka Sesi Praktikum'
            }
            onPress={() => setPendingAction(action)}
            disabled={!canChangeStatus}
          />

          <Pressable
            onPress={() => setDeleteModalVisible(true)}
            style={styles.deleteDangerButton}
            accessibilityRole="button">
            <Text style={styles.deleteDangerText}>Hapus Sesi Praktikum Ini</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* MODALS */}
      <ConfirmActionModal
        visible={pendingAction !== null}
        action={pendingAction ?? 'open'}
        sessionName={`${session.practicalName} (${session.className})`}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => void confirmAction()}
      />

      <SessionFormModal
        visible={editModalVisible}
        classes={classes}
        initialData={session}
        defaultAssistantName={assistantName}
        onClose={() => setEditModalVisible(false)}
        onSubmit={async (data) => {
          await updateSession(session.id, {
            date: data.date,
            startTime: data.startTime,
            endTime: data.endTime,
            topic: data.topic,
            room: data.room,
            assistantName: data.assistantName,
            practicalName: data.practicalName,
            className: data.className,
          });
          setFeedbackType('success');
          setFeedback('Informasi sesi berhasil diperbarui.');
        }}
      />

      <ConfirmDeleteModal
        visible={deleteModalVisible}
        title="Hapus Sesi Praktikum?"
        message={`Apakah Anda yakin ingin menghapus sesi "${session.practicalName} (${session.className})"? Praktikan tidak akan dapat mengakses sesi ini lagi.`}
        loading={deleting}
        onCancel={() => setDeleteModalVisible(false)}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}

function InfoRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
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
  hero: {
    backgroundColor: AppColors.primary,
    borderRadius: Radius.xl,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  eyebrow: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  title: {
    color: AppColors.textOnPrimary,
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '800',
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.one,
  },
  className: {
    color: AppColors.textOnPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  card: {
    backgroundColor: AppColors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: AppColors.border,
    ...CardShadow,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  cardTitle: {
    color: AppColors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  editButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.primary,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
  },
  infoRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  infoLabel: {
    color: AppColors.textMuted,
    fontSize: 13,
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
    color: AppColors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  attendanceCard: {
    backgroundColor: AppColors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: AppColors.border,
    ...CardShadow,
  },
  attendanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  muted: {
    color: AppColors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  countBadge: {
    minWidth: 56,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Radius.md,
    backgroundColor: AppColors.primarySoft,
    alignItems: 'center',
  },
  count: {
    color: AppColors.primary,
    fontSize: 17,
    fontWeight: '800',
  },
  countLabel: {
    color: AppColors.primary,
    fontSize: 10,
    fontWeight: '700',
  },
  attendanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two + 2,
    borderTopWidth: 1,
    borderTopColor: AppColors.border,
    gap: Spacing.two + 4,
  },
  studentAvatar: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.primarySoft,
  },
  studentInitial: {
    color: AppColors.primary,
    fontSize: 12,
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
  time: {
    color: AppColors.success,
    fontSize: 13,
    fontWeight: '700',
  },
  emptyAttendance: {
    color: AppColors.textMuted,
    borderTopWidth: 1,
    borderTopColor: AppColors.border,
    paddingTop: Spacing.three,
    fontSize: 13,
  },
  recapButton: {
    marginTop: Spacing.three,
  },
  actionArea: {
    backgroundColor: AppColors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: AppColors.border,
    gap: Spacing.two,
  },
  actionTitle: {
    color: AppColors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  actionDescription: {
    color: AppColors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: Spacing.two,
  },
  deleteDangerButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    marginTop: Spacing.one,
  },
  deleteDangerText: {
    color: AppColors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
});
