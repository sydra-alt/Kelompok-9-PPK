import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppColors, Radius } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';
import type { PracticeClass } from '@/types';

interface ClassFormModalProps {
  visible: boolean;
  initialData?: PracticeClass | null;
  onClose: () => void;
  onSubmit: (data: { name: string; practicalName: string }) => Promise<void>;
}

export function ClassFormModal({
  visible,
  initialData,
  onClose,
  onSubmit,
}: ClassFormModalProps) {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent>
      <View style={styles.backdrop}>
        <ClassFormContent
          key={initialData?.id ?? 'new-class'}
          initialData={initialData}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      </View>
    </Modal>
  );
}

function ClassFormContent({
  initialData,
  onClose,
  onSubmit,
}: {
  initialData?: PracticeClass | null;
  onClose: () => void;
  onSubmit: (data: { name: string; practicalName: string }) => Promise<void>;
}) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [practicalName, setPracticalName] = useState(initialData?.practicalName ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    const trimmedPractical = practicalName.trim();
    if (!trimmedName) {
      setError('Nama kelas wajib diisi (mis. TI-3A).');
      return;
    }
    if (!trimmedPractical) {
      setError('Nama praktikum wajib diisi (mis. Pemrograman Mobile).');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ name: trimmedName, practicalName: trimmedPractical });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan kelas.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.card} accessibilityViewIsModal>
      <Text style={styles.title}>
        {initialData ? 'Ubah Data Kelas' : 'Tambah Kelas Baru'}
      </Text>
      <Text style={styles.subtitle}>
        {initialData
          ? 'Perbarui informasi kelas praktikum.'
          : 'Buat kelas baru untuk praktikum dan jadwalkan sesi.'}
      </Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.field}>
        <Text style={styles.label}>Nama Kelas</Text>
        <TextInput
          value={name}
          editable={!submitting}
          onChangeText={(text) => {
            setName(text);
            setError(null);
          }}
          placeholder="Contoh: TI-3A"
          placeholderTextColor={AppColors.textMuted}
          style={styles.input}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Mata Praktikum</Text>
        <TextInput
          value={practicalName}
          editable={!submitting}
          onChangeText={(text) => {
            setPracticalName(text);
            setError(null);
          }}
          placeholder="Contoh: Pemrograman Mobile"
          placeholderTextColor={AppColors.textMuted}
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
          title={submitting ? 'Menyimpan...' : 'Simpan'}
          onPress={() => void handleSubmit()}
          disabled={submitting}
          style={styles.submitButton}
        />
      </View>
    </View>
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
