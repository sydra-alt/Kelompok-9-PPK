import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { AppColors, Radius } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';
import type { DummyUser, PracticeSession } from '@/types';
import { formatDate, formatTimeRange } from '@/utils/format';

interface AttendanceConfirmSheetProps {
  visible: boolean;
  session: PracticeSession;
  student: DummyUser;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Bottom sheet konfirmasi presensi (khusus alur praktikan).
 * Berisi form pernyataan kehadiran yang wajib dicentang sebelum konfirmasi.
 */
export function AttendanceConfirmSheet({
  visible,
  session,
  student,
  onCancel,
  onConfirm,
}: AttendanceConfirmSheetProps) {
  const insets = useSafeAreaInsets();
  const [agreed, setAgreed] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  // Reset form setiap kali sheet dibuka.
  useEffect(() => {
    if (visible) {
      setAgreed(false);
      setShowValidation(false);
    }
  }, [visible]);

  const handleConfirm = () => {
    if (!agreed) {
      setShowValidation(true);
      return;
    }
    onConfirm();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onCancel} accessibilityLabel="Tutup konfirmasi" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.four }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Konfirmasi Presensi</Text>
          <Text style={styles.subtitle}>Pastikan data berikut sudah benar sebelum mencatat kehadiran.</Text>

          <View style={styles.summary}>
            <SummaryRow label="Praktikan" value={`${student.name} (${student.identifier})`} />
            <SummaryRow label="Praktikum" value={session.practicalName} />
            <SummaryRow label="Kelas" value={session.className} />
            <SummaryRow label="Tanggal" value={formatDate(session.date)} />
            <SummaryRow label="Waktu" value={formatTimeRange(session.startTime, session.endTime)} />
          </View>

          <Pressable
            testID="attendance-agree-toggle"
            style={[styles.agreeRow, showValidation && !agreed && styles.agreeRowError]}
            onPress={() => {
              setAgreed((prev) => !prev);
              setShowValidation(false);
            }}>
            <Text style={styles.agreeText}>
              Saya menyatakan benar-benar hadir pada sesi praktikum ini.
            </Text>
            <Switch
              value={agreed}
              onValueChange={(value) => {
                setAgreed(value);
                setShowValidation(false);
              }}
              trackColor={{ true: AppColors.primary, false: AppColors.neutralSoft }}
              thumbColor={AppColors.surface}
            />
          </Pressable>
          {showValidation && !agreed ? (
            <Text style={styles.validation}>Centang pernyataan kehadiran terlebih dahulu.</Text>
          ) : null}

          <View style={styles.actions}>
            <AppButton title="Batal" variant="ghost" onPress={onCancel} style={styles.actionButton} />
            <AppButton
              testID="attendance-confirm-button"
              title="Ya, Presensi"
              onPress={handleConfirm}
              style={styles.actionButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: AppColors.overlay,
  },
  sheet: {
    backgroundColor: AppColors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two + 4,
    gap: Spacing.three,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: Radius.pill,
    backgroundColor: AppColors.border,
    marginBottom: Spacing.one,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: AppColors.text,
  },
  subtitle: {
    fontSize: 14,
    color: AppColors.textMuted,
    marginTop: -Spacing.two,
  },
  summary: {
    backgroundColor: AppColors.background,
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  summaryLabel: {
    fontSize: 13,
    color: AppColors.textMuted,
  },
  summaryValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.text,
  },
  agreeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  agreeRowError: {
    borderColor: AppColors.danger,
    backgroundColor: AppColors.dangerSoft,
  },
  agreeText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: AppColors.text,
  },
  validation: {
    fontSize: 13,
    color: AppColors.danger,
    marginTop: -Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two + 4,
  },
  actionButton: {
    flex: 1,
  },
});
