import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAssistantStore } from '@/data/assistant-store';
import type { SessionStatus } from '@/data/assistant-sessions';

const colors = { ink: '#172D27', muted: '#71817A', green: '#1E6B50', pale: '#EAF3ED', line: '#E5EBE7', white: '#FFFFFF', amber: '#A96816', amberPale: '#FFF2DA', gray: '#68736E', grayPale: '#EEF0EF' };
const statusText: Record<SessionStatus, string> = { upcoming: 'Belum dibuka', open: 'Sedang berlangsung', closed: 'Selesai' };

export default function AttendanceRecapScreen() {
  const { sessions, attendance } = useAssistantStore();
  const [selectedId, setSelectedId] = useState(sessions.find((session) => session.status === 'open')?.id ?? sessions[0]?.id ?? '');
  const selected = sessions.find((session) => session.id === selectedId);
  const records = useMemo(() => attendance.filter((record) => record.sessionId === selectedId), [attendance, selectedId]);

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ThemedText style={styles.eyebrow}>RUANG ASISTEN</ThemedText>
          <ThemedText style={styles.title}>Rekap kehadiran</ThemedText>
          <ThemedText style={styles.subtitle}>Pantau praktikan yang sudah mengisi presensi.</ThemedText>

          <ThemedText style={styles.label}>Pilih sesi praktikum</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sessionChoices}>
            {sessions.map((session) => <Pressable key={session.id} onPress={() => setSelectedId(session.id)} style={[styles.sessionChoice, selectedId === session.id && styles.sessionChoiceActive]}><ThemedText style={[styles.choiceClass, selectedId === session.id && styles.choiceClassActive]}>{session.className}</ThemedText><ThemedText style={[styles.choiceName, selectedId === session.id && styles.choiceNameActive]} numberOfLines={1}>{session.practicalName}</ThemedText></Pressable>)}
          </ScrollView>

          {selected ? <>
            <View style={styles.sessionBanner}><View style={styles.bannerIcon}><ThemedText style={styles.bannerIconText}>▦</ThemedText></View><View style={styles.bannerCopy}><ThemedText style={styles.bannerName}>{selected.practicalName}</ThemedText><ThemedText style={styles.bannerMeta}>{selected.className} · {selected.date}</ThemedText><ThemedText style={styles.bannerMeta}>{selected.startTime}–{selected.endTime} · {selected.room}</ThemedText></View><View style={[styles.pill, selected.status === 'open' ? styles.openPill : selected.status === 'upcoming' ? styles.upcomingPill : styles.closedPill]}><View style={[styles.dot, { backgroundColor: selected.status === 'open' ? colors.green : selected.status === 'upcoming' ? colors.amber : colors.gray }]} /><ThemedText style={[styles.pillText, { color: selected.status === 'open' ? colors.green : selected.status === 'upcoming' ? colors.amber : colors.gray }]}>{statusText[selected.status]}</ThemedText></View></View>
            <View style={styles.summaryRow}><View><ThemedText style={styles.summaryLabel}>Total hadir</ThemedText><ThemedText style={styles.summaryCount}>{records.length}<ThemedText style={styles.summaryTotal}> praktikan</ThemedText></ThemedText></View><View style={styles.summaryBadge}><ThemedText style={styles.summaryBadgeText}>●  Presensi tercatat</ThemedText></View></View>
            <View style={styles.listHeader}><ThemedText style={styles.listTitle}>Daftar kehadiran</ThemedText><ThemedText style={styles.listCount}>{records.length} orang</ThemedText></View>
            {records.length ? <View style={styles.records}>{records.map((record, index) => <View key={record.id} style={styles.record}><View style={styles.number}><ThemedText style={styles.numberText}>{String(index + 1).padStart(2, '0')}</ThemedText></View><View style={styles.student}><ThemedText style={styles.studentName}>{record.studentName}</ThemedText><ThemedText style={styles.studentId}>NIM {record.studentId}</ThemedText></View><View style={styles.timeBox}><ThemedText style={styles.time}>{record.time}</ThemedText><ThemedText style={styles.timeLabel}>Hadir</ThemedText></View></View>)}</View> : <View style={styles.empty}><View style={styles.emptyIcon}><ThemedText style={styles.emptyIconText}>◷</ThemedText></View><ThemedText style={styles.emptyTitle}>Belum ada presensi</ThemedText><ThemedText style={styles.emptyText}>Daftar praktikan yang hadir akan muncul di sini setelah presensi tercatat.</ThemedText></View>}
            <View style={styles.note}><ThemedText style={styles.noteMark}>i</ThemedText><ThemedText style={styles.noteText}>Rekap ini menggunakan data simulasi untuk kebutuhan demonstrasi.</ThemedText></View>
          </> : <View style={styles.empty}><ThemedText style={styles.emptyTitle}>Belum ada sesi</ThemedText><ThemedText style={styles.emptyText}>Jadwal praktikum belum tersedia.</ThemedText></View>}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, safe: { flex: 1 }, content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 22, paddingBottom: 36 }, eyebrow: { color: colors.green, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 }, title: { color: colors.ink, fontSize: 26, fontWeight: '800' }, subtitle: { color: colors.muted, fontSize: 14, marginTop: 6, marginBottom: 25 }, label: { color: colors.ink, fontSize: 13, fontWeight: '700', marginBottom: 10 }, sessionChoices: { gap: 9, paddingBottom: 20 }, sessionChoice: { width: 155, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 12, backgroundColor: colors.white }, sessionChoiceActive: { borderColor: colors.green, backgroundColor: colors.pale }, choiceClass: { color: colors.muted, fontSize: 10, fontWeight: '700' }, choiceClassActive: { color: colors.green }, choiceName: { color: colors.ink, fontSize: 12, fontWeight: '700', marginTop: 5 }, choiceNameActive: { color: colors.green },
  sessionBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1, borderRadius: 18, padding: 15 }, bannerIcon: { width: 43, height: 43, borderRadius: 13, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' }, bannerIconText: { color: colors.green, fontSize: 20 }, bannerCopy: { flex: 1, marginHorizontal: 11 }, bannerName: { color: colors.ink, fontSize: 13, fontWeight: '700' }, bannerMeta: { color: colors.muted, fontSize: 10, marginTop: 4 }, pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 14 }, openPill: { backgroundColor: colors.pale }, upcomingPill: { backgroundColor: colors.amberPale }, closedPill: { backgroundColor: colors.grayPale }, dot: { width: 6, height: 6, borderRadius: 3 }, pillText: { fontSize: 9, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 17, marginTop: 16 }, summaryLabel: { color: colors.muted, fontSize: 12 }, summaryCount: { color: colors.ink, fontSize: 25, fontWeight: '800', marginTop: 2 }, summaryTotal: { color: colors.muted, fontSize: 12, fontWeight: '500' }, summaryBadge: { backgroundColor: colors.pale, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8 }, summaryBadgeText: { color: colors.green, fontSize: 10, fontWeight: '700' }, listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 25, marginBottom: 12 }, listTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' }, listCount: { color: colors.muted, fontSize: 12 }, records: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 18, paddingHorizontal: 15 }, record: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line }, number: { width: 33, height: 33, borderRadius: 11, backgroundColor: colors.pale, justifyContent: 'center', alignItems: 'center' }, numberText: { color: colors.green, fontSize: 11, fontWeight: '800' }, student: { flex: 1, marginLeft: 11 }, studentName: { color: colors.ink, fontSize: 13, fontWeight: '700' }, studentId: { color: colors.muted, fontSize: 11, marginTop: 4 }, timeBox: { alignItems: 'flex-end' }, time: { color: colors.green, fontSize: 13, fontWeight: '800' }, timeLabel: { color: colors.muted, fontSize: 10, marginTop: 3 },
  empty: { alignItems: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 18, paddingHorizontal: 28, paddingVertical: 30 }, emptyIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }, emptyIconText: { color: colors.green, fontSize: 24 }, emptyTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' }, emptyText: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6 }, note: { flexDirection: 'row', gap: 9, alignItems: 'center', marginTop: 18, padding: 12, borderRadius: 12, backgroundColor: '#F2F7F3' }, noteMark: { width: 19, height: 19, overflow: 'hidden', textAlign: 'center', textAlignVertical: 'center', borderRadius: 10, color: colors.green, backgroundColor: colors.pale, fontSize: 12, fontWeight: '800' }, noteText: { flex: 1, color: colors.muted, fontSize: 11 },
});
