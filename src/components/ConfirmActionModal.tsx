import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppColors, Radius } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';

type SessionAction = 'open' | 'close';

interface ConfirmActionModalProps {
  visible: boolean;
  action: SessionAction;
  sessionName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Konfirmasi sebelum asisten mengubah status sesi. */
export function ConfirmActionModal({
  visible,
  action,
  sessionName,
  onCancel,
  onConfirm,
}: ConfirmActionModalProps) {
  const isOpening = action === 'open';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <View style={[styles.iconWrap, !isOpening && styles.closeIconWrap]}>
            <Text style={[styles.icon, !isOpening && styles.closeIcon]}>{isOpening ? '↗' : '✓'}</Text>
          </View>
          <Text style={styles.title}>{isOpening ? 'Buka sesi praktikum?' : 'Tutup sesi praktikum?'}</Text>
          <Text style={styles.message}>
            {isOpening
              ? `Praktikan dapat mulai presensi untuk ${sessionName} setelah sesi dibuka.`
              : `Praktikan tidak dapat melakukan presensi lagi untuk ${sessionName} setelah sesi ditutup.`}
          </Text>
          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={styles.cancelButton} accessibilityRole="button">
              <Text style={styles.cancelText}>Kembali</Text>
            </Pressable>
            <AppButton
              title={isOpening ? 'Ya, buka sesi' : 'Ya, tutup sesi'}
              onPress={onConfirm}
              style={styles.confirmButton}
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
    backgroundColor: AppColors.primarySoft,
    marginBottom: Spacing.three,
  },
  closeIconWrap: { backgroundColor: AppColors.dangerSoft },
  icon: { color: AppColors.primary, fontSize: 24, fontWeight: '800' },
  closeIcon: { color: AppColors.danger },
  title: { color: AppColors.text, fontSize: 20, fontWeight: '800' },
  message: { color: AppColors.textMuted, fontSize: 14, lineHeight: 21, marginTop: Spacing.two },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.four },
  cancelButton: {
    flex: 1,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  cancelText: { color: AppColors.text, fontSize: 15, fontWeight: '700' },
  confirmButton: { flex: 1 },
});
