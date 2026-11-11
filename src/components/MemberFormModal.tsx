import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppColors, Radius } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';
import type { PracticeClass } from '@/types';

interface MemberFormModalProps {
  visible: boolean;
  targetClass: PracticeClass | null;
  onClose: () => void;
  onSubmit: (data: {
    classId: string;
    className: string;
    studentId: string;
    studentName: string;
    studentIdentifier: string;
  }) => Promise<void>;
}

export function MemberFormModal({
  visible,
  targetClass,
  onClose,
  onSubmit,
}: MemberFormModalProps) {
  const [studentName, setStudentName] = useState('');
  const [studentIdentifier, setStudentIdentifier] = useState('');
  const [studentId, setStudentId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!targetClass) return;

    const trimmedName = studentName.trim();
    const trimmedNim = studentIdentifier.trim();
    const trimmedUid = studentId.trim();

    if (!trimmedName) {
      setError('Nama lengkap praktikan wajib diisi.');
      return;
    }
    if (!trimmedNim) {
      setError('NIM praktikan wajib diisi.');
      return;
    }
    if (!trimmedUid) {
      setError('UID praktikan (Firebase Auth UID) wajib diisi.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        classId: targetClass.id,
        className: targetClass.name,
        studentId: trimmedUid,
        studentName: trimmedName,
        studentIdentifier: trimmedNim,
      });
      setStudentName('');
      setStudentIdentifier('');
      setStudentId('');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menambahkan peserta.');
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
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.title}>Tambah Peserta Praktikum</Text>
          <Text style={styles.subtitle}>
            Kelas: <Text style={styles.bold}>{targetClass?.name}</Text> ({targetClass?.practicalName})
          </Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.field}>
            <Text style={styles.label}>Nama Praktikan</Text>
            <TextInput
              value={studentName}
              editable={!submitting}
              onChangeText={(text) => {
                setStudentName(text);
                setError(null);
              }}
              placeholder="Contoh: Ahmad Fauzan"
              placeholderTextColor={AppColors.textMuted}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>NIM Praktikan</Text>
            <TextInput
              value={studentIdentifier}
              editable={!submitting}
              onChangeText={(text) => {
                setStudentIdentifier(text);
                setError(null);
              }}
              placeholder="Contoh: 2211102001"
              placeholderTextColor={AppColors.textMuted}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>UID Praktikan (Firebase Auth UID)</Text>
            <TextInput
              value={studentId}
              editable={!submitting}
              onChangeText={(text) => {
                setStudentId(text);
                setError(null);
              }}
              placeholder="Salin UID dari Firebase Auth / profil"
              placeholderTextColor={AppColors.textMuted}
              autoCapitalize="none"
              style={styles.input}
            />
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              disabled={submitting}
              style={styles.cancelButton}
              accessibilityRole="button">
              <Text style={styles.cancelText}>Batal</Text>
            </Pressable>
            <AppButton
              title={submitting ? 'Menyimpan...' : 'Tambah Peserta'}
              onPress={() => void handleSubmit()}
              disabled={submitting}
              style={styles.submitButton}
            />
          </View>
        </View>
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
  card: {
    width: '100%',
    maxWidth: 440,
    padding: Spacing.four,
    borderRadius: Radius.xl,
    backgroundColor: AppColors.surface,
    gap: Spacing.three,
  },
  title: {
    color: AppColors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: AppColors.textMuted,
    fontSize: 13,
    marginTop: -Spacing.one,
  },
  bold: {
    fontWeight: '800',
    color: AppColors.primary,
  },
  errorText: {
    color: AppColors.danger,
    fontSize: 13,
    backgroundColor: AppColors.dangerSoft,
    padding: Spacing.two,
    borderRadius: Radius.md,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.text,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    fontSize: 14,
    color: AppColors.text,
    backgroundColor: AppColors.background,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  cancelButton: {
    flex: 1,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  cancelText: {
    color: AppColors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  submitButton: {
    flex: 1,
  },
});

