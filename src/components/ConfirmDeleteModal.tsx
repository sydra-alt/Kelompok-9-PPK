import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppColors, Radius } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';

interface ConfirmDeleteModalProps {
  visible: boolean;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

/** Modal konfirmasi penghapusan data dengan pencegahan data loss. */
export function ConfirmDeleteModal({
  visible,
  title,
  message,
  onCancel,
  onConfirm,
  loading = false,
}: ConfirmDeleteModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>🗑️</Text>
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              disabled={loading}
              style={styles.cancelButton}
              accessibilityRole="button">
              <Text style={styles.cancelText}>Batal</Text>
            </Pressable>
            <AppButton
              title={loading ? 'Menghapus...' : 'Ya, Hapus'}
              onPress={onConfirm}
              disabled={loading}
              style={styles.deleteButton}
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
    maxWidth: 420,
    padding: Spacing.four,
    borderRadius: Radius.xl,
    backgroundColor: AppColors.surface,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.dangerSoft,
    marginBottom: Spacing.three,
  },
  icon: {
    fontSize: 24,
  },
  title: {
    color: AppColors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  message: {
    color: AppColors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.four,
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
  deleteButton: {
    flex: 1,
    backgroundColor: AppColors.danger,
  },
});

