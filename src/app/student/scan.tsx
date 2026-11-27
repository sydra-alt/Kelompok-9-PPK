import { useState } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppColors, Radius } from '@/constants/app-theme';
import { AppButton } from '@/components/AppButton';
import { Spacing } from '@/constants/theme';

export default function StudentQrScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [handled, setHandled] = useState(false);

  const handleScan = ({ data }: { data: string }) => {
    if (handled) return;
    const match = /^ppk-attendance:([A-Za-z0-9_-]+)$/.exec(data.trim());
    if (!match) return;
    setHandled(true);
    router.replace({ pathname: '/student/attendance/[sessionId]' as any, params: { sessionId: match[1] } });
  };

  if (!permission) return <View style={styles.center}><Text style={styles.message}>Memeriksa izin kamera…</Text></View>;
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Izin kamera diperlukan</Text>
        <Text style={styles.message}>Izinkan kamera agar aplikasi dapat membaca QR presensi. Kamera hanya digunakan saat halaman pemindai dibuka.</Text>
        <AppButton title="Izinkan Kamera" onPress={() => void requestPermission()} />
        {!permission.canAskAgain ? <AppButton title="Buka Pengaturan" variant="secondary" onPress={() => void Linking.openSettings()} /> : null}
        <AppButton title="Kembali" variant="ghost" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={handleScan} />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Tutup pemindai" onPress={() => router.back()} style={styles.close}>
          <Text style={styles.closeText}>×</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Arahkan kamera ke QR sesi</Text>
      </View>
      <View pointerEvents="none" style={styles.frameWrap}><View style={styles.frame} /></View>
      <View style={styles.bottom}><Text style={styles.hint}>Setelah QR terbaca, halaman presensi sesi akan terbuka dan memeriksa lokasi perangkat.</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', gap: Spacing.three, padding: Spacing.four, backgroundColor: AppColors.background },
  title: { fontSize: 21, fontWeight: '800', color: AppColors.text, textAlign: 'center' },
  message: { fontSize: 14, lineHeight: 21, color: AppColors.textMuted, textAlign: 'center' },
  header: { position: 'absolute', top: 56, left: Spacing.three, right: Spacing.three, flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  close: { width: 44, height: 44, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)' },
  closeText: { color: '#fff', fontSize: 30, lineHeight: 34 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1 },
  frameWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 260, height: 260, borderColor: '#fff', borderWidth: 3, borderRadius: 24, backgroundColor: 'transparent' },
  bottom: { position: 'absolute', bottom: 42, left: Spacing.four, right: Spacing.four, padding: Spacing.three, borderRadius: Radius.lg, backgroundColor: 'rgba(0,0,0,0.68)' },
  hint: { color: '#fff', fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
