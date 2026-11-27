import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import qrcode from 'qrcode-generator';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  const { profile } = useAuth();
  const { sessions, loading, error, retry } = useAssistantData();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [clock, setClock] = useState<number | null>(null);
  useEffect(() => {
    const initialTimer = setTimeout(() => setClock(Date.now()), 0);
    const timer = setInterval(() => setClock(Date.now()), 5000);
    return () => { clearTimeout(initialTimer); clearInterval(timer); };
  }, []);
  const openSessions = useMemo(() => clock === null ? [] : sessions.filter((session) => session.status === 'open' && !hasSessionEnded(session, new Date(clock))), [sessions, clock]);
  const selected = sessions.find((session) => session.id === selectedId) ?? null;
  if (loading && sessions.length === 0) return <View style={styles.center}><Text style={styles.body}>Memuat sesi…</Text></View>;
  if (error && sessions.length === 0) return <View style={styles.center}><Text style={styles.body}>{error}</Text><AppButton title="Coba Lagi" onPress={retry} /></View>;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>{selected ? 'QR Presensi' : 'Pilih sesi yang sedang dibuka'}</Text>
      {selected ? (
        <>
          <Pressable onPress={() => setSelectedId(null)} style={styles.back}><Text style={styles.backText}>‹ Pilih sesi lain</Text></Pressable>
          <View style={styles.card}>
            <Text style={styles.sessionTitle}>{selected.practicalName} · {selected.className}</Text>
            <Text style={styles.body}>{formatDate(selected.date)} · {formatTimeRange(selected.startTime, selected.endTime)}</Text>
            {clock !== null && selected.status === 'open' && !hasSessionEnded(selected, new Date(clock)) ? (
              <WebView source={{ html: svgDocument(selected.id) }} style={styles.qr} scrollEnabled={false} originWhitelist={['*']} />
            ) : <EmptyState icon="⌛" title="QR kedaluwarsa" message="Sesi sudah ditutup atau waktu praktikum telah berakhir." />}
            <Text style={styles.caption}>QR ini tetap sama selama sesi aktif. QR tidak bisa dipakai setelah sesi ditutup atau waktunya berakhir.</Text>
          </View>
        </>
      ) : openSessions.length > 0 ? openSessions.map((session) => <SessionOption key={session.id} session={session} onPress={() => setSelectedId(session.id)} />) : (
        <EmptyState icon="▦" title="Tidak ada sesi aktif" message="QR presensi hanya tersedia untuk sesi yang sedang dibuka dan belum melewati waktu selesai." actionLabel="Kembali" onAction={() => router.back()} />
      )}
      {!profile || profile.role !== 'asisten' ? <Text style={styles.error}>Fitur ini hanya tersedia untuk asisten.</Text> : null}
    </ScrollView>
  );
}

function SessionOption({ session, onPress }: { session: PracticeSession; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}><Text style={styles.sessionTitle}>{session.practicalName} · {session.className}</Text><Text style={styles.body}>{formatDate(session.date)} · {formatTimeRange(session.startTime, session.endTime)}</Text><Text style={styles.action}>Tampilkan QR →</Text></Pressable>;
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
  back: { alignSelf: 'flex-start', paddingVertical: Spacing.one },
  backText: { color: AppColors.primary, fontSize: 14, fontWeight: '700' },
  action: { alignSelf: 'flex-end', color: AppColors.primary, fontWeight: '800' },
  error: { color: AppColors.danger, fontSize: 13 },
});
