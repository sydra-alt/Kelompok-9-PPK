import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AttendanceConfirmSheet } from '@/components/AttendanceConfirmSheet';
import { EmptyState } from '@/components/EmptyState';
import { FeedbackBanner, type FeedbackType } from '@/components/FeedbackBanner';
import { StatusBadge } from '@/components/StatusBadge';
import { AppColors, CardShadow, Radius } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';
import { getSessionById } from '@/data/schedules';
import { getUserById } from '@/data/users';
import {
  getAttendanceBlockReason,
  submitAttendance,
  useStudentAttendance,
} from '@/hooks/use-student-attendance';
import { navigateTo } from '@/navigation/AppNavigator';
import { formatDate, formatDateTime, formatTimeRange } from '@/utils/format';

interface Feedback {
  type: FeedbackType;
  title: string;
  message: string;
}

/** FR-03 & FR-05 — Detail sesi dan presensi praktikan. */
export default function StudentSessionDetailScreen() {
  const { sessionId, studentId } = useLocalSearchParams<{ sessionId: string; studentId: string }>();
  const session = getSessionById(sessionId);
  const student = getUserById(studentId);
  const records = useStudentAttendance(studentId);

  const [sheetVisible, setSheetVisible] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  if (!session || !student || student.role !== 'student') {
    return (
      <EmptyState
        icon="🔍"
        title="Sesi tidak ditemukan"
        message="Data sesi atau identitas praktikan tidak valid."
        actionLabel="Kembali ke Awal"
        onAction={navigateTo.roleSelection}
      />
    );
  }

  const myRecord = records.find((r) => r.sessionId === session.id);
  const blockReason = getAttendanceBlockReason(session);
  const canAttend = !myRecord && !blockReason;

  const handleOpenSheet = () => {
    // Validasi ulang sebelum membuka sheet (jaga-jaga jika state berubah).
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
    setSheetVisible(true);
  };

  const handleConfirm = () => {
    const result = submitAttendance(student, session);
    setSheetVisible(false);
    if (result.ok) {
      setFeedback({
        type: 'success',
        title: 'Presensi berhasil!',
        message: `Kehadiranmu tercatat pada ${formatDateTime(result.record.attendanceTime)}.`,
      });
    } else {
      setFeedback({ type: 'error', title: 'Presensi gagal', message: result.reason });
    }
  };

  const buttonTitle = myRecord
    ? '✓ Sudah Presensi'
    : session.status === 'upcoming'
      ? 'Sesi Belum Dibuka'
      : session.status === 'closed'
        ? 'Sesi Sudah Ditutup'
        : 'Presensi Sekarang';

  return (
    <>
      <ScrollView contentContainerStyle={styles.content}>
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
          <InfoRow icon="⏰" label="Waktu" value={formatTimeRange(session.startTime, session.endTime)} />
          {session.room ? <InfoRow icon="📍" label="Ruangan" value={session.room} /> : null}
          {session.assistantName ? (
            <InfoRow icon="🧑‍🏫" label="Asisten" value={session.assistantName} />
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Presensi</Text>

          {myRecord ? (
            <View style={[styles.statusBox, styles.statusBoxSuccess]}>
              <Text style={styles.statusIcon}>✅</Text>
              <View style={styles.statusTextBlock}>
                <Text style={[styles.statusTitle, { color: AppColors.success }]}>Kamu sudah hadir</Text>
                <Text style={styles.statusMessage}>
                  Tercatat pada {formatDateTime(myRecord.attendanceTime)}. Presensi hanya dapat dilakukan
                  satu kali per sesi.
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
                <Text style={[styles.statusTitle, { color: AppColors.primaryDark }]}>Sesi sedang dibuka</Text>
                <Text style={styles.statusMessage}>
                  Lakukan presensi sebelum sesi ditutup oleh asisten.
                </Text>
              </View>
            </View>
          )}

          <AppButton
            testID="attendance-button"
            title={buttonTitle}
            disabled={!canAttend}
            onPress={handleOpenSheet}
          />
        </View>
      </ScrollView>

      <AttendanceConfirmSheet
        visible={sheetVisible}
        session={session}
        student={student}
        onCancel={() => setSheetVisible(false)}
        onConfirm={handleConfirm}
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
});
