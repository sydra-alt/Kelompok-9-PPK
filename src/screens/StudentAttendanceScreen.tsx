import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { EmptyState } from '@/components/EmptyState';
import { LoadingState } from '@/components/LoadingState';
import { StatusBadge } from '@/components/StatusBadge';
import { AppColors, CardShadow, Radius } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useStudentData } from '@/context/StudentDataContext';
import { submitAttendance, getAttendanceBlockReason } from '@/services/attendance-service';
import { getErrorMessage } from '@/services/errors';
import { getCurrentDeviceLocation } from '@/services/location-service';
import { subscribeLab, subscribeSession } from '@/services/student-data-service';
import type { Lab, PracticeSession } from '@/types';
import type { Coordinates } from '@/utils/distance';
import { distanceInMeters } from '@/utils/distance';
import { formatDate, formatTimeRange } from '@/utils/format';

export default function StudentAttendanceScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { profile } = useAuth();
  const { sessions, attendance, permissionRequests, isOffline, fromCache } = useStudentData();
  const [sessionSnapshot, setSessionSnapshot] = useState<PracticeSession | null>(null);
  const [labSnapshot, setLabSnapshot] = useState<{
    labId: string;
    lab: Lab | null;
    error: string | null;
  } | null>(null);
  const [deviceLocation, setDeviceLocation] = useState<Coordinates | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [checkingLocation, setCheckingLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const session = sessionSnapshot ?? sessions.find((item) => item.id === sessionId) ?? null;
  const labState = session?.labId && labSnapshot?.labId === session.labId ? labSnapshot : null;
  const lab = labState?.lab ?? null;
  const labError = labState?.error ?? null;
  const existingAttendance = attendance.find((record) => record.sessionId === sessionId);
  const permissionApproved = permissionRequests.some(
    (request) => request.sessionId === sessionId && request.status === 'approved',
  );

  useEffect(() => {
    if (!sessionId) return undefined;
    return subscribeSession(
      sessionId,
      (nextSession) => setSessionSnapshot(nextSession),
      () => setSessionSnapshot(null),
    );
  }, [sessionId]);

  useEffect(() => {
    if (!session?.labId) return undefined;

    return subscribeLab(
      session.labId,
      (nextLab) => {
        setLabSnapshot({
          labId: session.labId!,
          lab: nextLab,
          error: nextLab ? null : 'Data lab belum tersedia atau koordinat/radius belum valid.',
        });
      },
      (error) =>
        setLabSnapshot({
          labId: session.labId!,
          lab: null,
          error: getErrorMessage(error, 'Gagal memuat lokasi laboratorium.'),
        }),
    );
  }, [session?.labId]);

  const refreshLocation = useCallback(async () => {
    setCheckingLocation(true);
    setLocationError(null);
    setFeedback(null);
    try {
      const current = await getCurrentDeviceLocation();
      setDeviceLocation(current);
    } catch (error) {
      setDeviceLocation(null);
      setLocationError(getErrorMessage(error, 'Lokasi tidak dapat diperoleh. Aktifkan GPS lalu coba lagi.'));
    } finally {
      setCheckingLocation(false);
    }
  }, []);

  const distanceMeters = useMemo(() => {
    if (!deviceLocation || !lab) return null;
    return distanceInMeters(deviceLocation, lab);
  }, [deviceLocation, lab]);

  const blockReason = session ? getAttendanceBlockReason(session) : null;
  const insideRadius = distanceMeters !== null && lab !== null && distanceMeters <= lab.radiusMeters;
  const canSubmit = Boolean(
    profile &&
      session &&
      session.status === 'open' &&
      lab &&
      insideRadius &&
      !existingAttendance &&
      !permissionApproved,
  );

  const handleSubmit = async () => {
    if (!profile || !session || submitting || !canSubmit) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      await submitAttendance(session.id);
      setFeedback('Presensi berhasil dicatat. Data kehadiran sudah tersimpan.');
    } catch (error) {
      setFeedback(getErrorMessage(error, 'Presensi gagal. Periksa koneksi dan coba lagi.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!profile || profile.role !== 'praktikan') {
    return (
      <EmptyState
        icon="📍"
        title="Akses Praktikan Diperlukan"
        message="Masuk dengan akun praktikan untuk melakukan presensi."
        actionLabel="Kembali"
        onAction={() => router.back()}
      />
    );
  }

  if (!session) {
    return (
      <LoadingState
        title="Memuat halaman presensi..."
        message="Mengambil informasi sesi dari Firestore."
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <ConnectionBanner isOffline={isOffline} fromCache={fromCache} error={null} />

      <View style={styles.card}>
        <View style={styles.titleRow}>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>{session.practicalName}</Text>
            <Text style={styles.subtitle}>{session.className}</Text>
          </View>
          <StatusBadge status={session.status} />
        </View>
        <View style={styles.divider} />
        <InfoRow label="Tanggal" value={formatDate(session.date)} />
        <InfoRow label="Waktu" value={formatTimeRange(session.startTime, session.endTime)} />
        <InfoRow label="Laboratorium" value={lab?.name ?? session.labName ?? 'Belum ditautkan'} />
        {session.room ? <InfoRow label="Ruangan" value={session.room} /> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Pemeriksaan lokasi</Text>
        {blockReason ? <Notice tone="warning" message={blockReason} /> : null}
        {permissionApproved ? (
          <Notice tone="warning" message="Pengajuan izin sesi ini sudah disetujui; presensi tidak tersedia." />
        ) : null}
        {existingAttendance ? (
          <Notice tone="success" message="Presensi untuk sesi ini sudah tercatat." />
        ) : null}
        {labError ? <Notice tone="danger" message={labError} /> : null}
        {!labError && !lab ? <Text style={styles.hint}>Memuat data laboratorium...</Text> : null}
        {locationError ? <Notice tone="danger" message={locationError} /> : null}
        {distanceMeters !== null && lab ? (
          <Notice
            tone={insideRadius ? 'success' : 'danger'}
            message={
              insideRadius
                ? `Di dalam radius: sekitar ${Math.round(distanceMeters)} m dari lab (batas ${lab.radiusMeters} m).`
                : `Di luar radius: sekitar ${Math.round(distanceMeters)} m dari lab (batas ${lab.radiusMeters} m).`
            }
          />
        ) : !blockReason && !locationError ? (
          <Text style={styles.hint}>Periksa lokasi untuk melihat jarak Anda dari laboratorium.</Text>
        ) : null}

        {feedback ? <Notice tone={feedback.startsWith('Presensi berhasil') ? 'success' : 'danger'} message={feedback} /> : null}

        <AppButton
          title={checkingLocation ? 'Memeriksa lokasi...' : deviceLocation ? 'Periksa Lokasi Lagi' : 'Periksa Lokasi'}
          variant="secondary"
          disabled={checkingLocation || !lab}
          onPress={() => void refreshLocation()}
        />
        {locationError?.includes('Pengaturan') ? (
          <AppButton
            title="Buka Pengaturan Aplikasi"
            variant="ghost"
            onPress={() => void Linking.openSettings()}
          />
        ) : null}
        <AppButton
          testID="submit-location-attendance"
          title={submitting ? 'Mencatat Presensi...' : 'Presensi Sekarang'}
          disabled={!canSubmit || submitting}
          onPress={() => void handleSubmit()}
        />
      </View>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function Notice({ message, tone }: { message: string; tone: 'success' | 'warning' | 'danger' }) {
  const toneStyle = tone === 'success' ? styles.success : tone === 'warning' ? styles.warning : styles.danger;
  return (
    <View style={[styles.notice, toneStyle]}>
      <Text style={styles.noticeText}>{message}</Text>
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
  card: {
    backgroundColor: AppColors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: Spacing.four,
    gap: Spacing.three,
    ...CardShadow,
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  titleBlock: { flex: 1, gap: 4 },
  title: { fontSize: 21, fontWeight: '800', color: AppColors.text },
  subtitle: { fontSize: 14, color: AppColors.textMuted },
  divider: { height: 1, backgroundColor: AppColors.border },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: AppColors.text },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three },
  infoLabel: { fontSize: 13, color: AppColors.textMuted },
  infoValue: { flex: 1, textAlign: 'right', fontSize: 13, fontWeight: '600', color: AppColors.text },
  hint: { fontSize: 13, lineHeight: 19, color: AppColors.textMuted },
  notice: { padding: Spacing.three, borderRadius: Radius.md },
  success: { backgroundColor: AppColors.successSoft },
  warning: { backgroundColor: AppColors.warningSoft },
  danger: { backgroundColor: AppColors.dangerSoft },
  noticeText: { color: AppColors.text, fontSize: 13, lineHeight: 19 },
});
