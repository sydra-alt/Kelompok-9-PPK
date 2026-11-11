import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { AppColors, Radius } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';
import {
  REASON_MAX_LENGTH,
  REASON_MIN_LENGTH,
  validatePermissionReason,
} from '@/services/permission-service';
import type { PracticeSession } from '@/types';
import { formatDate, formatTimeRange } from '@/utils/format';

interface PermissionRequestSheetProps {
  visible: boolean;
  session: PracticeSession;
  submitting?: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
}

const QUICK_TEMPLATES = [
  'Sakit dan sedang menjalani pemeriksaan/istirahat medis.',
  'Ada keperluan keluarga mendesak yang tidak dapat ditinggalkan.',
  'Mengikuti kegiatan akademik/lomba resmi kampus pada jam yang sama.',
];

/**
 * Bottom sheet pengajuan izin untuk sesi tertentu (PIC: Programmer 1).
 * Memvalidasi panjang alasan sebelum mengirim ke Firestore & API AI.
 */
export function PermissionRequestSheet({
  visible,
  session,
  submitting = false,
  onCancel,
  onSubmit,
}: PermissionRequestSheetProps) {
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const resetForm = () => {
    setReason('');
    setValidationError(null);
  };

  const handleSubmit = () => {
    if (submitting) return;
    const error = validatePermissionReason(reason);
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError(null);
    onSubmit(reason.trim());
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onShow={resetForm}
      onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={submitting ? undefined : onCancel}
          accessibilityLabel="Tutup form pengajuan izin"
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.four }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Ajukan Izin Praktikum</Text>
          <Text style={styles.subtitle}>
            Jelaskan alasan ketidakhadiranmu secara jelas. Pengajuan akan berstatus{' '}
            <Text style={styles.subtitleBold}>Menunggu Keputusan</Text> hingga diperiksa asisten.
          </Text>

          <View style={styles.sessionBox}>
            <Text style={styles.sessionTitle}>
              {session.practicalName} • Kelas {session.className}
            </Text>
            <Text style={styles.sessionMeta}>
              {formatDate(session.date)} • {formatTimeRange(session.startTime, session.endTime)}
            </Text>
          </View>

          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Alasan Izin</Text>
              <Text style={styles.counter}>
                {reason.trim().length}/{REASON_MAX_LENGTH} (min. {REASON_MIN_LENGTH})
              </Text>
            </View>
            <TextInput
              testID="permission-reason-input"
              value={reason}
              editable={!submitting}
              onChangeText={(text) => {
                setReason(text);
                if (validationError) setValidationError(null);
              }}
              placeholder="Contoh: Saya tidak dapat hadir karena sedang demam tinggi dan harus beristirahat sesuai anjuran dokter..."
              placeholderTextColor={AppColors.textMuted}
              multiline
              maxLength={REASON_MAX_LENGTH}
              textAlignVertical="top"
              style={[styles.input, validationError && styles.inputError]}
            />
            {validationError ? (
              <Text testID="permission-reason-error" style={styles.errorText}>
                {validationError}
              </Text>
            ) : null}
          </View>

          <View style={styles.templateSection}>
            <Text style={styles.templateLabel}>Contoh alasan cepat:</Text>
            <View style={styles.templateList}>
              {QUICK_TEMPLATES.map((tpl) => (
                <Pressable
                  key={tpl}
                  disabled={submitting}
                  onPress={() => {
                    setReason(tpl);
                    setValidationError(null);
                  }}
                  style={({ pressed }) => [styles.templateChip, pressed && styles.pressed]}>
                  <Text style={styles.templateText} numberOfLines={1}>
                    + {tpl}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.aiHintBox}>
            <Text style={styles.aiHintIcon}>🤖</Text>
            <Text style={styles.aiHintText}>
              Alasan akan diklasifikasikan otomatis oleh AI sebagai informasi pendukung bagi asisten. Jika
              layanan AI tidak tersedia, pengajuan tetap tersimpan dan diproses.
            </Text>
          </View>

          <View style={styles.actions}>
            <AppButton
              title="Batal"
              variant="ghost"
              disabled={submitting}
              onPress={onCancel}
              style={styles.actionButton}
            />
            <AppButton
              testID="permission-submit-button"
              title={submitting ? 'Mengirim...' : 'Kirim Pengajuan'}
              disabled={submitting}
              onPress={handleSubmit}
              style={styles.actionButton}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
    fontSize: 13,
    lineHeight: 19,
    color: AppColors.textMuted,
    marginTop: -Spacing.two,
  },
  subtitleBold: {
    fontWeight: '700',
    color: AppColors.text,
  },
  sessionBox: {
    backgroundColor: AppColors.background,
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: 2,
  },
  sessionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.text,
  },
  sessionMeta: {
    fontSize: 12,
    color: AppColors.textMuted,
  },
  fieldGroup: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.text,
  },
  counter: {
    fontSize: 12,
    color: AppColors.textMuted,
  },
  input: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: Radius.md,
    padding: Spacing.three,
    fontSize: 14,
    lineHeight: 20,
    color: AppColors.text,
    backgroundColor: AppColors.background,
  },
  inputError: {
    borderColor: AppColors.danger,
    backgroundColor: AppColors.dangerSoft,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.danger,
  },
  templateSection: {
    gap: 6,
  },
  templateLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.textMuted,
  },
  templateList: {
    gap: 6,
  },
  templateChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    backgroundColor: AppColors.primarySoft,
  },
  templateText: {
    fontSize: 12,
    color: AppColors.primaryDark,
    fontWeight: '600',
  },
  aiHintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    padding: Spacing.two + 4,
    borderRadius: Radius.md,
    backgroundColor: AppColors.background,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  aiHintIcon: {
    fontSize: 15,
  },
  aiHintText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: AppColors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two + 4,
  },
  actionButton: {
    flex: 1,
  },
  pressed: {
    opacity: 0.8,
  },
});
