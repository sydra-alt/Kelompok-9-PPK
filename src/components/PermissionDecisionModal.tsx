import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AiCategoryChip, PermissionStatusBadge } from '@/components/PermissionStatusBadge';
import { AppColors, Radius } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';
import type { PermissionRequest, PermissionStatus } from '@/types';
import { formatDate } from '@/utils/format';

interface PermissionDecisionModalProps {
  visible: boolean;
  request: PermissionRequest | null;
  onClose: () => void;
  onDecide: (requestId: string, decision: PermissionStatus, note?: string) => Promise<void>;
}

export function PermissionDecisionModal({
  visible,
  request,
  onClose,
  onDecide,
}: PermissionDecisionModalProps) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!request) return null;

  const handleDecision = async (decision: 'approved' | 'rejected') => {
    setSubmitting(true);
    setError(null);
    try {
      await onDecide(request.id, decision, note.trim() || undefined);
      setNote('');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan keputusan izin.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}>
          <View style={styles.card} accessibilityViewIsModal>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
              <View style={styles.headerRow}>
                <View style={styles.titleBlock}>
                  <Text style={styles.eyebrow}>KEPUTUSAN IZIN</Text>
                  <Text style={styles.title}>Pengajuan Izin Praktikan</Text>
                </View>
                <PermissionStatusBadge status={request.status} />
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <View style={styles.infoSection}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Praktikan</Text>
                  <Text style={styles.infoValue}>
                    {request.studentName} ({request.studentIdentifier})
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Kelas & Praktikum</Text>
                  <Text style={styles.infoValue}>
                    {request.className} • {request.practicalName}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Tanggal Sesi</Text>
                  <Text style={styles.infoValue}>{formatDate(request.sessionDate)}</Text>
                </View>
              </View>

              <View style={styles.reasonCard}>
                <Text style={styles.reasonLabel}>Alasan yang Diajukan:</Text>
                <Text style={styles.reasonText}>{request.reason}</Text>
              </View>

              <View style={styles.aiCard}>
                <Text style={styles.aiTitle}>Analisis AI Classifier:</Text>
                <AiCategoryChip classification={request.aiClassification} />
                <Text style={styles.aiDisclaimer}>
                  ⚠️ Keputusan akhir mutlak berada di tangan asisten. Hasil klasifikasi AI hanya
                  berfungsi sebagai referensi pendukung dan tidak menentukan status izin secara otomatis.
                </Text>
              </View>

              {request.status !== 'pending' ? (
                <View style={styles.decisionHistoryCard}>
                  <Text style={styles.historyTitle}>Riwayat Keputusan:</Text>
                  <Text style={styles.historyText}>
                    Oleh: {request.decidedByName ?? 'Asisten'}
                  </Text>
                  {request.decidedAt ? (
                    <Text style={styles.historyText}>Waktu: {request.decidedAt}</Text>
                  ) : null}
                  {request.decisionNote ? (
                    <Text style={styles.historyText}>Catatan: &ldquo;{request.decisionNote}&rdquo;</Text>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.field}>
                <Text style={styles.label}>Catatan Keputusan (Opsional)</Text>
                <TextInput
                  value={note}
                  editable={!submitting}
                  onChangeText={setNote}
                  placeholder="Tambahkan catatan untuk praktikan (mis. 'Surat dokter valid')"
                  placeholderTextColor={AppColors.textMuted}
                  multiline
                  numberOfLines={3}
                  style={styles.textArea}
                />
              </View>

              <View style={styles.actions}>
                <Pressable
                  onPress={onClose}
                  disabled={submitting}
                  style={styles.cancelButton}
                  accessibilityRole="button">
                  <Text style={styles.cancelText}>Tutup</Text>
                </Pressable>

                <Pressable
                  onPress={() => void handleDecision('rejected')}
                  disabled={submitting}
                  style={[styles.rejectButton, submitting && styles.disabled]}
                  accessibilityRole="button">
                  <Text style={styles.rejectText}>✕ Tolak</Text>
                </Pressable>

                <Pressable
                  onPress={() => void handleDecision('approved')}
                  disabled={submitting}
                  style={[styles.approveButton, submitting && styles.disabled]}
                  accessibilityRole="button">
                  <Text style={styles.approveText}>✓ Setujui</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
    backgroundColor: AppColors.overlay,
  },
  keyboardView: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '92%',
  },
  card: {
    width: '100%',
    padding: Spacing.four,
    borderRadius: Radius.xl,
    backgroundColor: AppColors.surface,
  },
  scroll: {
    gap: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  titleBlock: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: AppColors.primary,
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: AppColors.text,
    marginTop: 2,
  },
  errorText: {
    color: AppColors.danger,
    fontSize: 13,
    backgroundColor: AppColors.dangerSoft,
    padding: Spacing.two,
    borderRadius: Radius.md,
  },
  infoSection: {
    backgroundColor: AppColors.background,
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: Spacing.one + 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 12,
    color: AppColors.textMuted,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.text,
  },
  reasonCard: {
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: 4,
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.textMuted,
  },
  reasonText: {
    fontSize: 14,
    lineHeight: 20,
    color: AppColors.text,
    fontStyle: 'italic',
  },
  aiCard: {
    backgroundColor: AppColors.primarySoft,
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  aiTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.primaryDark,
  },
  aiDisclaimer: {
    fontSize: 11,
    lineHeight: 16,
    color: AppColors.neutral,
  },
  decisionHistoryCard: {
    backgroundColor: AppColors.background,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: 2,
  },
  historyTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.text,
  },
  historyText: {
    fontSize: 12,
    color: AppColors.textMuted,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.text,
  },
  textArea: {
    minHeight: 70,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: Radius.md,
    padding: Spacing.three,
    fontSize: 13,
    color: AppColors.text,
    backgroundColor: AppColors.background,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  cancelButton: {
    minHeight: 48,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  cancelText: {
    color: AppColors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  rejectButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: AppColors.dangerSoft,
    borderWidth: 1,
    borderColor: AppColors.danger,
  },
  rejectText: {
    color: AppColors.danger,
    fontSize: 14,
    fontWeight: '800',
  },
  approveButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: AppColors.success,
  },
  approveText: {
    color: AppColors.textOnPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.6,
  },
});

