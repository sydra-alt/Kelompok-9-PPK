import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AnimatedModal, ModalMotion } from '@/components/ModalMotion';
import { AppColors, Radius } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';
import type { PracticeClass, UserProfile } from '@/types';

interface MemberFormModalProps {
  visible: boolean;
  targetClass: PracticeClass | null;
  onClose: () => void;
  onLookup: (identifier: string) => Promise<UserProfile | null>;
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
  onLookup,
  onSubmit,
}: MemberFormModalProps) {
  const [studentIdentifier, setStudentIdentifier] = useState('');
  const [matchedStudent, setMatchedStudent] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleLookup = async () => {
    const nim = studentIdentifier.trim();
    if (!nim) {
      setError('Masukkan NIM praktikan terlebih dahulu.');
      setMatchedStudent(null);
      setLookupMessage(null);
      return;
    }

    setSearching(true);
    setError(null);
    setLookupMessage(null);
    setMatchedStudent(null);
    try {
      const result = await onLookup(nim);
      if (result) {
        setMatchedStudent(result);
        setLookupMessage('Akun praktikan ditemukan. Pastikan nama dan NIM sesuai sebelum menambahkan.');
      } else {
        setLookupMessage('Akun praktikan dengan NIM ini tidak ditemukan. Pastikan praktikan sudah membuat akun.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mencari akun praktikan.');
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async () => {
    if (!targetClass || !matchedStudent) {
      setError('Cari dan pilih akun praktikan terlebih dahulu.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        classId: targetClass.id,
        className: targetClass.name,
        studentId: matchedStudent.uid,
        studentName: matchedStudent.name,
        studentIdentifier: matchedStudent.identifier,
      });
      setStudentIdentifier('');
      setMatchedStudent(null);
      setLookupMessage(null);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menambahkan peserta.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatedModal
      visible={visible}
      variant="popup"
      onRequestClose={onClose}
      >
      <View style={styles.backdrop}>
        <ModalMotion variant="popup" style={styles.motion}>
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.title}>Tambah Peserta Praktikum</Text>
          <Text style={styles.subtitle}>Cari akun praktikan menggunakan NIM. UID akan dihubungkan otomatis.</Text>
          <Text style={styles.subtitle}>
            Kelas: <Text style={styles.bold}>{targetClass?.name}</Text> ({targetClass?.practicalName})
          </Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.field}>
            <Text style={styles.label}>NIM Praktikan</Text>
            <TextInput
              value={studentIdentifier}
              editable={!submitting && !searching}
              onChangeText={(text) => {
                setStudentIdentifier(text);
                setMatchedStudent(null);
                setLookupMessage(null);
                setError(null);
              }}
              placeholder="Masukkan NIM praktikan"
              placeholderTextColor={AppColors.textMuted}
              autoCapitalize="none"
              style={styles.input}
            />
          </View>

          <AppButton
            title={searching ? 'Mencari...' : 'Cari Praktikan'}
            variant="secondary"
            onPress={() => void handleLookup()}
            disabled={searching || submitting}
            style={styles.lookupButton}
          />

          {lookupMessage ? (
            <Text style={matchedStudent ? styles.successText : styles.hintText}>{lookupMessage}</Text>
          ) : null}
          {matchedStudent ? (
            <View style={styles.matchCard}>
              <Text style={styles.matchName}>{matchedStudent.name}</Text>
              <Text style={styles.hintText}>NIM: {matchedStudent.identifier}</Text>
            </View>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              disabled={submitting || searching}
              style={styles.cancelButton}
              accessibilityRole="button">
              <Text style={styles.cancelText}>Batal</Text>
            </Pressable>
            <AppButton
              title={submitting ? 'Menyimpan...' : 'Tambah Peserta'}
              onPress={() => void handleSubmit()}
              disabled={submitting || searching || !matchedStudent}
              style={styles.submitButton}
            />
          </View>
        </View>
        </ModalMotion>
      </View>
    </AnimatedModal>
  );
}

const styles = StyleSheet.create({
  motion: { width: '100%', maxWidth: 440 },
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
  successText: {
    color: AppColors.success,
    fontSize: 13,
    lineHeight: 19,
  },
  hintText: {
    color: AppColors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  matchCard: {
    padding: Spacing.three,
    borderRadius: Radius.md,
    backgroundColor: AppColors.successSoft,
    gap: Spacing.one,
  },
  matchName: {
    color: AppColors.text,
    fontSize: 14,
    fontWeight: '700',
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
  lookupButton: {
    width: '100%',
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

