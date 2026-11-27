import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
// The package uses CommonJS `export = qrcode`; this default import is its documented Metro entry.
// eslint-disable-next-line import/no-named-as-default
import qrcode from 'qrcode-generator';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { AppButton } from '@/components/AppButton';
import { EmptyState } from '@/components/EmptyState';
import { AppColors, CardShadow, Radius } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';
import { useAssistantData } from '@/context/AssistantDataContext';
import { useAuth } from '@/context/AuthContext';
import type { PracticeSession } from '@/types';
import { hasSessionEnded } from '@/utils/session-time';
import { formatDate, formatTimeRange } from '@/utils/format';

function svgDocument(sessionId: string) {
  const qr = qrcode(0, 'M');
  qr.addData(`ppk-attendance:${sessionId}`);
  qr.make();
  return `<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;display:grid;place-items:center;background:#fff;height:100vh">${qr.createSvgTag({ scalable: true, margin: 3 })}</body></html>`;
}

export default function AssistantQrScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { profile } = useAuth();
  const { sessions, loading, error, retry } = useAssistantData();
  const [clock, setClock] = useState<number | null>(null);
  useEffect(() => {
    const initialTimer = setTimeout(() => setClock(Date.now()), 0);
    const timer = setInterval(() => setClock(Date.now()), 5000);
    return () => { clearTimeout(initialTimer); clearInterval(timer); };
  }, []);

  const session = sessions.find((item) => item.id === sessionId) as PracticeSession | undefined;
  if (!profile || profile.role !== 'asisten') {
    return <View style={styles.center}><EmptyState icon="🔒" title="Fitur asisten" message="QR presensi hanya dapat dibuka oleh asisten." /></View>;
  }
  if (!session && loading) return <View style={styles.center}><Text style={styles.body}>Memuat data sesi…</Text></View>;
  if (!session) {
    return <View style={styles.center}><Text style={styles.body}>{error ?? 'Sesi tidak ditemukan.'}</Text><AppButton title="Coba Lagi" onPress={retry} /></View>;
  }

  const qrIsValid = clock !== null && session.status === 'open' && !hasSessionEnded(session, new Date(clock));
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>QR Presensi</Text>
      <View style={styles.card}>
        <Text style={styles.sessionTitle}>{session.practicalName} · {session.className}</Text>
        <Text style={styles.body}>{formatDate(session.date)} · {formatTimeRange(session.startTime, session.endTime)}</Text>
        {qrIsValid ? (
          <WebView key={session.id} source={{ html: svgDocument(session.id) }} style={styles.qr} scrollEnabled={false} originWhitelist={['*']} />
        ) : (
          <EmptyState icon="⌛" title="QR belum aktif atau sudah kedaluwarsa" message="QR hanya tampil saat sesi berstatus dibuka dan sebelum waktu selesai." />
        )}
        <Text style={styles.caption}>QR sesi ini akan tetap sama jika halaman dibuka ulang. QR tidak berlaku setelah sesi ditutup atau waktunya selesai.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.three },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
  title: { fontSize: 21, fontWeight: '800', color: AppColors.text },
  card: { padding: Spacing.four, gap: Spacing.two, borderRadius: Radius.lg, borderWidth: 1, borderColor: AppColors.border, backgroundColor: AppColors.surface, ...CardShadow },
  sessionTitle: { fontSize: 16, fontWeight: '800', color: AppColors.text },
  body: { fontSize: 14, lineHeight: 20, color: AppColors.textMuted },
  qr: { width: '100%', height: 320, backgroundColor: '#fff', borderRadius: Radius.md, overflow: 'hidden' },
  caption: { fontSize: 13, lineHeight: 19, color: AppColors.textMuted, textAlign: 'center' },
});
