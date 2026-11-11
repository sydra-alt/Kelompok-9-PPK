import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AttendanceConfirmSheet } from '@/components/AttendanceConfirmSheet';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { EmptyState } from '@/components/EmptyState';
import { FeedbackBanner, type FeedbackType } from '@/components/FeedbackBanner';
import { LoadingState } from '@/components/LoadingState';
import { PermissionRequestSheet } from '@/components/PermissionRequestSheet';
import { AiCategoryChip, PermissionStatusBadge } from '@/components/PermissionStatusBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { AppColors, CardShadow, Radius } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useStudentData } from '@/context/StudentDataContext';
import { navigateTo } from '@/navigation/AppNavigator';
import { getAttendanceBlockReason, submitAttendance } from '@/services/attendance-service';
import { getErrorMessage } from '@/services/errors';
import { classifyPermissionRequest, submitPermissionRequest } from '@/services/permission-service';
import { subscribeSession } from '@/services/student-data-service';
import type { PracticeSession } from '@/types';
import { formatDate, formatDateTime, formatTimeRange } from '@/utils/format';

interface Feedback {
  type: FeedbackType;
  title: string;
  message: string;
}

/**
 * FR-03, FR-05 & Pengajuan Izin (Sprint 2) — Detail sesi praktikum real-time,
 * presensi dengan transaksi anti-duplikat, serta pengajuan izin + klasifikasi AI.
 */
export default function StudentSessionDetailScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { profile } = useAuth();
  const {
    sessions,
    attendance,
    permissionRequests,
    loading: listLoading,
    fromCache,
    isOffline,
    retry,
  } = useStudentData();

  const cachedSession = sessions.find((s) => s.id === sessionId) ?? null;
  const [retryKey, setRetryKey] = useState(0);
  const scopeKey = sessionId ? `${sessionId}:${retryKey}` : null;
  const [sessionSnap, setSessionSnap] = useState<{
    key: string;
    session: PracticeSession | null;
    error: string | null;
  } | null>(null);

  const [attendanceSheetVisible, setAttendanceSheetVisible] = useState(false);
  const [permissionSheetVisible, setPermissionSheetVisible] = useState(false);
  const [submittingAttendance, setSubmittingAttendance] = useState(false);
  const [submittingPermission, setSubmittingPermission] = useState(false);
  const [retryingAi, setRetryingAi] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // Listener real-time dokumen sesi agar pembukaan/penutupan oleh asisten langsung tercermin.
  useEffect(() => {
    if (!sessionId || !scopeKey) return undefined;

    const unsubscribe = subscribeSession(
      sessionId,
      (nextSession) => {
        setSessionSnap({ key: scopeKey, session: nextSession, error: null });
      },
      (err) => {
        setSessionSnap({
          key: scopeKey,
          session: null,
          error: getErrorMessage(err, 'Gagal memuat detail sesi praktikum.'),
        });
      },
    );

    return unsubscribe;
  }, [sessionId, scopeKey]);

  const isSessionSnapReady = Boolean(scopeKey && sessionSnap?.key === scopeKey);
  const liveSession = isSessionSnapReady ? (sessionSnap?.session ?? null) : null;
  const sessionError = isSessionSnapReady ? (sessionSnap?.error ?? null) : null;
  const sessionLoading = Boolean(scopeKey && !isSessionSnapReady && !cachedSession);
  const session = liveSession ?? cachedSession;

  if (!profile || profile.role !== 'praktikan') {
    return (
      <EmptyState
        icon="🔍"
        title="Akses Praktikan Diperlukan"
        message="Silakan masuk menggunakan akun praktikan untuk mengakses sesi ini."
        actionLabel="Kembali ke Login"
        onAction={navigateTo.roleSelection}
      />
    );
  }

  if ((sessionLoading || listLoading) && !session) {
    return (
      <LoadingState
        title="Memuat detail sesi..."
        message="Menyinkronkan status sesi dan kehadiran secara real-time."
      />
    );
  }

  if (sessionError && !session) {
    return (
      <EmptyState
        icon="⚠️"
        title="Gagal memuat sesi"
        message={sessionError}
        actionLabel="Coba Lagi"
        onAction={() => {
          retry();
          setRetryKey((prev) => prev + 1);
        }}
      />
    );
  }

  if (!session) {
    return (
      <EmptyState
        icon="🔍"
        title="Sesi tidak ditemukan"
        message="Sesi praktikum tidak ditemukan atau sudah dihapus oleh asisten."
        actionLabel="Kembali ke Beranda"
        onAction={() => router.back()}
      />
    );
  }

  const myRecord = attendance.find((r) => r.sessionId === session.id);
  const myPermission = permissionRequests.find((p) => p.sessionId === session.id);
  const blockReason = getAttendanceBlockReason(session);
  const canAttend = !myRecord && !blockReason && myPermission?.status !== 'approved';
  const canRequestPermission = !myRecord && !myPermission && session.status !== 'closed';

  const handleOpenAttendanceSheet = () => {
    if (myRecord) {
      setFeedback({
        type: 'error',
        title: 'Presensi ditolak',
        message: 'Kamu sudah melakukan presensi pada sesi ini.',
      });
      return;
    }
    if (blockReason) {
      setFeedback({ type: 'error', title: 'Presensi tidak tersedia', message: blockReason });
      return;
    }
    setAttendanceSheetVisible(true);
  };

  const handleConfirmAttendance = async () => {
    setSubmittingAttendance(true);
    setFeedback(null);
    try {
      await submitAttendance(profile, session.id);
      setAttendanceSheetVisible(false);
      setFeedback({
        type: 'success',
        title: 'Presensi berhasil!',
        message: 'Kehadiranmu telah tersimpan di Firestore dan langsung tercatat pada rekap asisten.',
      });
    } catch (err) {
      setAttendanceSheetVisible(false);
      setFeedback({
        type: 'error',
        title: 'Presensi gagal',
        message: getErrorMessage(err, 'Gagal menyimpan presensi. Periksa koneksi lalu coba lagi.'),
      });
    } finally {
      setSubmittingAttendance(false);
    }
  };

  const handleSubmitPermission = async (reason: string) => {
    setSubmittingPermission(true);
    setFeedback(null);
    try {
      await submitPermissionRequest(profile, session.id, reason);
      setPermissionSheetVisible(false);
      setFeedback({
        type: 'success',
        title: 'Pengajuan izin terkirim',
        message:
          'Pengajuan izin disimpan dengan status Menunggu Keputusan. Klasifikasi alasan oleh AI sedang diproses sebagai informasi pendukung.',
      });
    } catch (err) {
      setPermissionSheetVisible(false);
      setFeedback({
        type: 'error',
        title: 'Pengajuan izin gagal',
        message: getErrorMessage(err, 'Gagal mengirim pengajuan izin.'),
      });
    } finally {
      setSubmittingPermission(false);
    }
  };

  const handleRetryAi = async () => {
    if (!myPermission) return;
    setRetryingAi(true);
    try {
      await classifyPermissionRequest(myPermission.id, myPermission.reason);
    } finally {
      setRetryingAi(false);
    }
  };

  const attendanceButtonTitle = myRecord
    ? '✓ Sudah Presensi'
    : myPermission?.status === 'approved'
      ? 'Izin Sudah Disetujui'
      : session.status === 'scheduled'
        ? 'Sesi Belum Dibuka'
        : session.status === 'closed'
          ? 'Sesi Sudah Ditutup'
          : 'Presensi Sekarang';

  return (
    <>
      <ScrollView contentContainerStyle={styles.content}>
        <ConnectionBanner
          isOffline={isOffline}
          fromCache={fromCache}
          error={sessionError}
          onRetry={() => {
            retry();
            setRetryKey((prev) => prev + 1);
          }}
        />

        {feedback ? (
          <FeedbackBanner
            testID="attendance-feedback"
            type={feedback.type}
            title={feedback.title}
            message={feedback.message}
            onClose={() => setFeedback(null)}
          />
        ) : null}

        <View style={styles.card}>
          <View style={styles.titleRow}>
            <View style={styles.titleBlock}>
              <Text style={styles.practicalName}>{session.practicalName}</Text>
              {session.topic ? <Text style={styles.topic}>{session.topic}</Text> : null}
            </View>
            <StatusBadge status={session.status} />
          </View>

          <View style={styles.divider} />

          <InfoRow icon="🏷️" label="Kelas" value={session.className} />
          <InfoRow icon="📅" label="Tanggal" value={formatDate(session.date)} />
          <InfoRow
            icon="⏰"
            label="Waktu"
            value={formatTimeRange(session.startTime, session.endTime)}
          />
          {session.room ? <InfoRow icon="📍" label="Ruangan" value={session.room} /> : null}
          {session.assistantName ? (
            <InfoRow icon="🧑‍🏫" label="Asisten" value={session.assistantName} />
          ) : null}
        </View>

        {/* Bagian Presensi */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Presensi Kehadiran</Text>

          {myRecord ? (
            <View style={[styles.statusBox, styles.statusBoxSuccess]}>
              <Text style={styles.statusIcon}>✅</Text>
              <View style={styles.statusTextBlock}>
                <Text style={[styles.statusTitle, { color: AppColors.success }]}>
                  Kamu sudah hadir
                </Text>
                <Text style={styles.statusMessage}>
                  Tercatat pada {formatDateTime(myRecord.attendanceTime)}. Presensi hanya dapat
                  dilakukan satu kali per sesi (ID deterministik).
                </Text>
              </View>
            </View>
          ) : blockReason ? (
            <View
              style={[
                styles.statusBox,
                session.status === 'closed' ? styles.statusBoxNeutral : styles.statusBoxWarning,
              ]}>
              <Text style={styles.statusIcon}>{session.status === 'closed' ? '🔒' : '⏳'}</Text>
              <View style={styles.statusTextBlock}>
                <Text style={styles.statusTitle}>Presensi tidak tersedia</Text>
                <Text testID="attendance-block-reason" style={styles.statusMessage}>
                  {blockReason}
                </Text>
              </View>
            </View>
          ) : (
            <View style={[styles.statusBox, styles.statusBoxPrimary]}>
              <Text style={styles.statusIcon}>🟢</Text>
              <View style={styles.statusTextBlock}>
                <Text style={[styles.statusTitle, { color: AppColors.primaryDark }]}>
                  Sesi sedang dibuka
                </Text>
                <Text style={styles.statusMessage}>
                  Lakukan presensi sebelum sesi ditutup oleh asisten. Perubahan status sesi
                  diperbarui secara real-time.
                </Text>
              </View>
            </View>
          )}

          <AppButton
            testID="attendance-button"
            title={attendanceButtonTitle}
            disabled={!canAttend || submittingAttendance}
            onPress={handleOpenAttendanceSheet}
          />
        </View>

        {/* Bagian Pengajuan Izin + Klasifikasi AI */}
        <View style={styles.card}>
          <View style={styles.permissionHeader}>
            <Text style={styles.sectionTitle}>Pengajuan Izin</Text>
            {myPermission ? <PermissionStatusBadge status={myPermission.status} /> : null}
          </View>

          {myPermission ? (
            <View style={styles.permissionDetail}>
              <View style={styles.reasonBox}>
                <Text style={styles.reasonLabel}>Alasan yang diajukan:</Text>
                <Text style={styles.reasonText}>{myPermission.reason}</Text>
              </View>

              <View style={styles.aiSection}>
                <AiCategoryChip classification={myPermission.aiClassification} />
                {myPermission.aiClassification.status === 'failed' ? (
                  <Pressable
                    testID="retry-ai-button"
                    disabled={retryingAi}
                    onPress={() => void handleRetryAi()}
                    style={styles.retryAiButton}>
                    <Text style={styles.retryAiText}>
                      {retryingAi ? 'Memproses...' : 'Coba Klasifikasi Ulang'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              {myPermission.status !== 'pending' ? (
                <View
                  style={[
                    styles.statusBox,
                    myPermission.status === 'approved'
                      ? styles.statusBoxSuccess
                      : styles.statusBoxDanger,
                  ]}>
                  <Text style={styles.statusIcon}>
                    {myPermission.status === 'approved' ? '✅' : '❌'}
                  </Text>
                  <View style={styles.statusTextBlock}>
                    <Text style={styles.statusTitle}>
                      Keputusan Asisten:{' '}
                      {myPermission.status === 'approved' ? 'Izin Disetujui' : 'Izin Ditolak'}
                    </Text>
                    <Text style={styles.statusMessage}>
                      {myPermission.decidedByName ? `Oleh ${myPermission.decidedByName}` : ''}
                      {myPermission.decidedAt
                        ? ` • ${formatDateTime(myPermission.decidedAt)}`
                        : ''}
                    </Text>
                    {myPermission.decisionNote ? (
                      <Text style={styles.statusMessage}>
                        Catatan: {myPermission.decisionNote}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ) : (
                <Text style={styles.permissionHint}>
                  Pengajuanmu sedang menunggu pemeriksaan asisten. Status keputusan di atas akan
                  berubah otomatis secara real-time saat asisten memberi keputusan.
                </Text>
              )}

              <AppButton
                title="Lihat Semua Pengajuan Izin"
                variant="secondary"
                onPress={navigateTo.studentPermissions}
              />
            </View>
          ) : (
            <>
              <Text style={styles.permissionHint}>
                {myRecord
                  ? 'Kamu sudah tercatat hadir pada sesi ini sehingga tidak perlu mengajukan izin.'
                  : session.status === 'closed'
                    ? 'Sesi sudah ditutup. Pengajuan izin baru tidak dapat dikirim.'
                    : 'Berhalangan hadir karena sakit atau keperluan mendesak? Ajukan izin beserta alasan yang jelas sebelum sesi ditutup.'}
              </Text>
              <AppButton
                testID="open-permission-sheet-button"
                title="Ajukan Izin Tidak Hadir"
                variant="secondary"
                disabled={!canRequestPermission || submittingPermission}
                onPress={() => setPermissionSheetVisible(true)}
              />
            </>
          )}
        </View>
      </ScrollView>

      <AttendanceConfirmSheet
        visible={attendanceSheetVisible}
        session={session}
        student={{ name: profile.name, identifier: profile.identifier }}
        submitting={submittingAttendance}
        onCancel={() => setAttendanceSheetVisible(false)}
        onConfirm={() => void handleConfirmAttendance()}
      />

      <PermissionRequestSheet
        visible={permissionSheetVisible}
        session={session}
        submitting={submittingPermission}
        onCancel={() => setPermissionSheetVisible(false)}
        onSubmit={(reason) => void handleSubmitPermission(reason)}
      />
    </>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoIcon}>{icon}</Text>
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
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  card: {
    backgroundColor: AppColors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: Spacing.four,
    gap: Spacing.three,
    ...CardShadow,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  titleBlock: {
    flex: 1,
    gap: 4,
  },
  practicalName: {
    fontSize: 22,
    fontWeight: '800',
    color: AppColors.text,
  },
  topic: {
    fontSize: 14,
    color: AppColors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: AppColors.border,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
  },
  infoIcon: {
    fontSize: 15,
    width: 22,
    textAlign: 'center',
  },
  infoLabel: {
    width: 80,
    fontSize: 14,
    color: AppColors.textMuted,
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.text,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: AppColors.text,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two + 4,
    padding: Spacing.three,
    borderRadius: Radius.md,
  },
  statusBoxSuccess: {
    backgroundColor: AppColors.successSoft,
  },
  statusBoxWarning: {
    backgroundColor: AppColors.warningSoft,
  },
  statusBoxNeutral: {
    backgroundColor: AppColors.neutralSoft,
  },
  statusBoxPrimary: {
    backgroundColor: AppColors.primarySoft,
  },
  statusBoxDanger: {
    backgroundColor: AppColors.dangerSoft,
  },
  statusIcon: {
    fontSize: 18,
  },
  statusTextBlock: {
    flex: 1,
    gap: 2,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.text,
  },
  statusMessage: {
    fontSize: 13,
    lineHeight: 19,
    color: AppColors.text,
  },
  permissionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  permissionDetail: {
    gap: Spacing.three,
  },
  reasonBox: {
    backgroundColor: AppColors.background,
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: 4,
  },
  reasonLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: AppColors.textMuted,
    textTransform: 'uppercase',
  },
  reasonText: {
    fontSize: 14,
    lineHeight: 20,
    color: AppColors.text,
  },
  aiSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  retryAiButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: AppColors.primary,
  },
  retryAiText: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.primary,
  },
  permissionHint: {
    fontSize: 13,
    lineHeight: 19,
    color: AppColors.textMuted,
  },
});
