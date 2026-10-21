import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAssistantStore } from '@/data/assistant-store';
import type { AssistantSession, SessionStatus } from '@/data/assistant-sessions';

const palette = { ink: '#172D27', muted: '#71817A', green: '#1E6B50', pale: '#EAF3ED', line: '#E5EBE7', amber: '#A96816', amberPale: '#FFF2DA', gray: '#68736E', grayPale: '#EEF0EF', white: '#FFFFFF', red: '#B33A32' };

function statusLabel(status: SessionStatus) {
  if (status === 'open') return 'Sedang berlangsung';
  if (status === 'closed') return 'Selesai';
  return 'Belum dibuka';
}

function StatusPill({ status }: { status: SessionStatus }) {
  const tint = status === 'open' ? palette.green : status === 'upcoming' ? palette.amber : palette.gray;
  const bg = status === 'open' ? palette.pale : status === 'upcoming' ? palette.amberPale : palette.grayPale;
  return <View style={[styles.pill, { backgroundColor: bg }]}><View style={[styles.dot, { backgroundColor: tint }]} /><ThemedText style={[styles.pillText, { color: tint }]}>{statusLabel(status)}</ThemedText></View>;
}

function SessionCard({ session, count, onPress }: { session: AssistantSession; count: number; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Detail ${session.practicalName}`} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.cardTop}><ThemedText style={styles.classLabel}>{session.className}</ThemedText><StatusPill status={session.status} /></View>
      <ThemedText style={styles.sessionName}>{session.practicalName}</ThemedText>
      <ThemedText style={styles.meta}>{session.date} · {session.startTime}–{session.endTime}</ThemedText>
      <View style={styles.cardBottom}><ThemedText style={styles.meta}>{session.room}</ThemedText><ThemedText style={styles.attendeeCount}>◉  {count} hadir</ThemedText></View>
    </Pressable>
  );
}

export default function AssistantHomeScreen() {
  const { sessions, attendance, setSessionStatus } = useAssistantStore();
  const [selected, setSelected] = useState<AssistantSession | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [filter, setFilter] = useState<'Semua' | 'Aktif' | 'Akan datang'>('Semua');
  const filtered = useMemo(() => sessions.filter((session) => filter === 'Semua' || (filter === 'Aktif' ? session.status === 'open' : session.status === 'upcoming')), [filter, sessions]);
  const selectedCurrent = selected ? sessions.find((session) => session.id === selected.id) ?? selected : null;

  function closeDetail() { setSelected(null); setConfirming(false); }
  function confirmStatusChange() {
    if (!selectedCurrent) return;
    setSessionStatus(selectedCurrent.id, selectedCurrent.status === 'open' ? 'closed' : 'open');
    closeDetail();
  }

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}><View><ThemedText style={styles.eyebrow}>RUANG ASISTEN</ThemedText><ThemedText style={styles.greeting}>Selamat pagi, Kak 👋</ThemedText><ThemedText style={styles.subtitle}>Siap mengelola praktikum hari ini?</ThemedText></View><View style={styles.avatar}><ThemedText style={styles.avatarText}>AS</ThemedText></View></View>
          <View style={styles.summary}><View style={styles.summaryIcon}><ThemedText style={styles.summaryIconText}>▦</ThemedText></View><View style={styles.summaryCopy}><ThemedText style={styles.summaryTitle}>Jadwal hari ini</ThemedText><ThemedText style={styles.summaryDescription}>{sessions.filter((s) => s.date.includes('21 Oktober')).length} sesi praktikum terjadwal</ThemedText></View><ThemedText style={styles.summaryArrow}>›</ThemedText></View>
          <View style={styles.sectionHeading}><View><ThemedText style={styles.sectionTitle}>Jadwal praktikum</ThemedText><ThemedText style={styles.sectionSub}>{sessions.length} sesi dalam jadwal</ThemedText></View><ThemedText style={styles.calendarIcon}>▣</ThemedText></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {(['Semua', 'Aktif', 'Akan datang'] as const).map((item) => <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filter, filter === item && styles.filterSelected]}><ThemedText style={[styles.filterText, filter === item && styles.filterSelectedText]}>{item}</ThemedText></Pressable>)}
          </ScrollView>
          {filtered.length ? <View style={styles.list}>{filtered.map((session) => <SessionCard key={session.id} session={session} count={attendance.filter((record) => record.sessionId === session.id).length} onPress={() => { setSelected(session); setConfirming(false); }} />)}</View> : <View style={styles.empty}><ThemedText style={styles.emptyIcon}>▤</ThemedText><ThemedText style={styles.emptyTitle}>Belum ada jadwal</ThemedText><ThemedText style={styles.emptyText}>Jadwal untuk filter ini akan tampil di sini.</ThemedText></View>}
          <View style={styles.tip}><ThemedText style={styles.tipIcon}>✦</ThemedText><ThemedText style={styles.tipText}>Ketuk sesi untuk melihat detail dan mengubah statusnya.</ThemedText></View>
        </ScrollView>
      </SafeAreaView>

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={closeDetail}>
        <View style={styles.backdrop}><View style={styles.modalCard}>
          <View style={styles.modalHandle} />
          {selectedCurrent && (confirming ? <>
            <ThemedText style={styles.modalEyebrow}>KONFIRMASI</ThemedText>
            <ThemedText style={styles.modalTitle}>{selectedCurrent.status === 'open' ? 'Tutup sesi praktikum?' : 'Buka sesi praktikum?'}</ThemedText>
            <ThemedText style={styles.modalBody}>{selectedCurrent.status === 'open' ? 'Praktikan tidak dapat melakukan presensi setelah sesi ditutup.' : 'Praktikan dapat mulai melakukan presensi setelah sesi dibuka.'}</ThemedText>
            <View style={styles.modalActions}><Pressable onPress={() => setConfirming(false)} style={styles.cancelButton}><ThemedText style={styles.cancelText}>Kembali</ThemedText></Pressable><Pressable onPress={confirmStatusChange} style={[styles.primaryButton, selectedCurrent.status === 'open' && styles.closeButton]}><ThemedText style={styles.primaryText}>{selectedCurrent.status === 'open' ? 'Ya, tutup sesi' : 'Ya, buka sesi'}</ThemedText></Pressable></View>
          </> : <>
            <View style={styles.modalHeader}><ThemedText style={styles.modalEyebrow}>DETAIL SESI</ThemedText><Pressable onPress={closeDetail} hitSlop={12}><ThemedText style={styles.closeX}>×</ThemedText></Pressable></View>
            <ThemedText style={styles.modalTitle}>{selectedCurrent.practicalName}</ThemedText><StatusPill status={selectedCurrent.status} />
            <View style={styles.details}><DetailLine label="Kelas" value={selectedCurrent.className} /><DetailLine label="Tanggal" value={selectedCurrent.date} /><DetailLine label="Waktu" value={`${selectedCurrent.startTime}–${selectedCurrent.endTime}`} /><DetailLine label="Lokasi" value={selectedCurrent.room} /><DetailLine label="Sudah hadir" value={`${attendance.filter((r) => r.sessionId === selectedCurrent.id).length} praktikan`} /></View>
            <Pressable disabled={selectedCurrent.status === 'closed'} onPress={() => setConfirming(true)} style={[styles.primaryButton, styles.fullButton, selectedCurrent.status === 'closed' && styles.disabledButton]}><ThemedText style={styles.primaryText}>{selectedCurrent.status === 'open' ? 'Tutup sesi' : selectedCurrent.status === 'closed' ? 'Sesi sudah selesai' : 'Buka sesi'}</ThemedText></Pressable>
          </>)}
        </View></View>
      </Modal>
    </ThemedView>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) { return <View style={styles.detailLine}><ThemedText style={styles.detailLabel}>{label}</ThemedText><ThemedText style={styles.detailValue}>{value}</ThemedText></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1 }, safe: { flex: 1 }, content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 18, paddingBottom: 36 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }, eyebrow: { color: palette.green, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 }, greeting: { color: palette.ink, fontSize: 25, fontWeight: '800', letterSpacing: -0.5 }, subtitle: { color: palette.muted, fontSize: 14, marginTop: 5 }, avatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: palette.pale, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: palette.green, fontWeight: '800', fontSize: 15 },
  summary: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.green, borderRadius: 20, padding: 18, marginBottom: 28 }, summaryIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)', justifyContent: 'center', alignItems: 'center' }, summaryIconText: { color: palette.white, fontSize: 22 }, summaryCopy: { flex: 1, marginLeft: 14 }, summaryTitle: { color: palette.white, fontWeight: '700', fontSize: 15 }, summaryDescription: { color: '#D5E9DE', fontSize: 12, marginTop: 4 }, summaryArrow: { color: palette.white, fontSize: 26, paddingLeft: 8 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, sectionTitle: { color: palette.ink, fontSize: 20, fontWeight: '800' }, sectionSub: { color: palette.muted, fontSize: 13, marginTop: 5 }, calendarIcon: { color: palette.green, backgroundColor: palette.pale, overflow: 'hidden', padding: 11, borderRadius: 12, fontSize: 17 }, filters: { gap: 8, paddingVertical: 18 }, filter: { borderWidth: 1, borderColor: palette.line, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20 }, filterSelected: { backgroundColor: palette.ink, borderColor: palette.ink }, filterText: { color: palette.gray, fontSize: 13, fontWeight: '600' }, filterSelectedText: { color: palette.white }, list: { gap: 12 },
  card: { backgroundColor: palette.white, borderRadius: 18, padding: 17, borderWidth: 1, borderColor: palette.line }, pressed: { opacity: 0.8 }, cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, classLabel: { color: palette.green, backgroundColor: palette.pale, fontSize: 11, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7, overflow: 'hidden' }, pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start' }, dot: { width: 6, height: 6, borderRadius: 3 }, pillText: { fontSize: 10, fontWeight: '700' }, sessionName: { color: palette.ink, fontSize: 16, fontWeight: '750', marginTop: 13 }, meta: { color: palette.muted, fontSize: 12, marginTop: 8 }, cardBottom: { borderTopWidth: 1, borderTopColor: palette.line, marginTop: 14, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, attendeeCount: { color: palette.green, fontSize: 12, fontWeight: '700' },
  empty: { alignItems: 'center', padding: 32, backgroundColor: palette.white, borderRadius: 18, borderWidth: 1, borderColor: palette.line }, emptyIcon: { color: palette.green, fontSize: 28, marginBottom: 10 }, emptyTitle: { color: palette.ink, fontWeight: '700', fontSize: 15 }, emptyText: { color: palette.muted, fontSize: 13, textAlign: 'center', marginTop: 6 }, tip: { backgroundColor: '#F2F7F3', borderRadius: 12, padding: 13, flexDirection: 'row', gap: 9, alignItems: 'center', marginTop: 18 }, tipIcon: { color: palette.green, fontSize: 16 }, tipText: { color: palette.muted, fontSize: 12, flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,30,24,0.45)', justifyContent: 'flex-end', alignItems: 'center' }, modalCard: { width: '100%', maxWidth: 600, backgroundColor: palette.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 34 }, modalHandle: { width: 38, height: 4, backgroundColor: '#D8DFDA', borderRadius: 3, alignSelf: 'center', marginBottom: 20 }, modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, modalEyebrow: { color: palette.green, fontSize: 11, fontWeight: '800', letterSpacing: 1.3 }, closeX: { color: palette.muted, fontSize: 28, lineHeight: 28 }, modalTitle: { color: palette.ink, fontSize: 22, fontWeight: '800', marginTop: 8, marginBottom: 13 }, modalBody: { color: palette.muted, fontSize: 14, lineHeight: 21, marginBottom: 23 }, details: { marginTop: 15, marginBottom: 22, borderTopWidth: 1, borderTopColor: palette.line }, detailLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.line }, detailLabel: { color: palette.muted, fontSize: 13 }, detailValue: { color: palette.ink, fontSize: 13, fontWeight: '600', maxWidth: '65%', textAlign: 'right' }, modalActions: { flexDirection: 'row', gap: 10 }, cancelButton: { flex: 1, borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 13 }, cancelText: { color: palette.ink, fontWeight: '700' }, primaryButton: { flex: 1, backgroundColor: palette.green, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 13 }, primaryText: { color: palette.white, fontSize: 14, fontWeight: '700' }, fullButton: { width: '100%' }, closeButton: { backgroundColor: palette.red }, disabledButton: { backgroundColor: '#AEB7B2' },
});
