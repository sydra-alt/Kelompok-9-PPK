import { router, useLocalSearchParams } from 'expo-router';
import Constants from 'expo-constants';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { AppButton } from '@/components/AppButton';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { AnimatedModal, ModalMotion } from '@/components/ModalMotion';
import { EmptyState } from '@/components/EmptyState';
import { FeedbackBanner } from '@/components/FeedbackBanner';
import { LoadingState } from '@/components/LoadingState';
import { StatusBadge } from '@/components/StatusBadge';
import { AppColors, CardShadow, Radius } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useStudentData } from '@/context/StudentDataContext';
import { submitAttendance, getAttendanceBlockReason } from '@/services/attendance-service';
import { getErrorMessage } from '@/services/errors';
import { getCurrentDeviceLocation, watchDeviceLocation } from '@/services/location-service';
import { subscribeLab, subscribeSession } from '@/services/student-data-service';
import type { Lab, PracticeSession } from '@/types';
import type { Coordinates } from '@/utils/distance';
import { distanceInMeters } from '@/utils/distance';
import { formatDate, formatTimeRange } from '@/utils/format';

const MAPS_KEY = Constants.expoConfig?.extra?.googleMapsApiKey;

function createAttendanceMapHtml(apiKey: string) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>html,body,#map{height:100%;width:100%;margin:0;padding:0}</style></head><body><div id="map"></div><script>
  let map, labMarker, deviceMarker, radiusCircle;window.mapPayload=null;
  window.initMap=()=>{map=new google.maps.Map(document.getElementById('map'),{center:{lat:-7.05436,lng:110.43553},zoom:16,clickableIcons:false,fullscreenControl:false,mapTypeControl:false,streetViewControl:false,gestureHandling:'greedy'});if(window.mapPayload)window.updateAttendanceMap(window.mapPayload)};
  window.updateAttendanceMap=(data)=>{window.mapPayload=data;if(!map||!data)return;const lab={lat:data.lab.latitude,lng:data.lab.longitude};if(!labMarker)labMarker=new google.maps.Marker({map,position:lab,title:data.lab.name});else labMarker.setPosition(lab);if(radiusCircle)radiusCircle.setMap(null);radiusCircle=new google.maps.Circle({map,center:lab,radius:data.lab.radiusMeters,strokeColor:'#4f46e5',strokeOpacity:.85,strokeWeight:2,fillColor:'#4f46e5',fillOpacity:.13,clickable:false});const bounds=new google.maps.LatLngBounds();bounds.extend(lab);if(data.device){const pos={lat:data.device.latitude,lng:data.device.longitude};bounds.extend(pos);if(!deviceMarker)deviceMarker=new google.maps.Marker({map,position:pos,title:'Lokasi perangkat',icon:{path:google.maps.SymbolPath.CIRCLE,scale:8,fillColor:'#15803d',fillOpacity:1,strokeColor:'#fff',strokeWeight:2},zIndex:1000});else deviceMarker.setPosition(pos);}else if(deviceMarker){deviceMarker.setMap(null);deviceMarker=null;}map.fitBounds(bounds,56)};
  window.gm_authFailure=()=>window.ReactNativeWebView&&window.ReactNativeWebView.postMessage('Google Maps menolak API key atau kuotanya habis.');
  const script=document.createElement('script');script.src=${JSON.stringify(`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=initMap`)};script.async=true;script.onerror=()=>window.ReactNativeWebView&&window.ReactNativeWebView.postMessage('Peta gagal dimuat. Periksa koneksi internet dan Maps API key.');document.head.appendChild(script);
  </script></body></html>`;
}

export default function StudentAttendanceScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { profile } = useAuth();
  const { sessions, attendance, permissionRequests, isOffline, fromCache } = useStudentData();
  const [sessionSnapshot, setSessionSnapshot] = useState<PracticeSession | null>(null);
  const [labSnapshot, setLabSnapshot] = useState<{
    labId: string;
    lab: Lab | null;
    error: string | null;
  } | null>(null);
  const [deviceLocation, setDeviceLocation] = useState<Coordinates | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [checkingLocation, setCheckingLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [successModalMessage, setSuccessModalMessage] = useState<string | null>(null);
  const mapRef = useRef<WebView<object> | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const session = sessionSnapshot ?? sessions.find((item) => item.id === sessionId) ?? null;
  const labState = session?.labId && labSnapshot?.labId === session.labId ? labSnapshot : null;
  const lab = labState?.lab ?? null;
  const labError = labState?.error ?? null;
  const existingAttendance = attendance.find((record) => record.sessionId === sessionId);
  const permissionApproved = permissionRequests.some(
    (request) => request.sessionId === sessionId && request.status === 'approved',
  );

  useEffect(() => {
    if (!sessionId) return undefined;
    return subscribeSession(
      sessionId,
      (nextSession) => setSessionSnapshot(nextSession),
      () => setSessionSnapshot(null),
    );
  }, [sessionId]);

  useEffect(() => {
    const sessionKey = session?.id;
    const labKey = lab?.id;
    if (!sessionKey || !labKey) return undefined;
    let active = true;
    let subscription: { remove: () => void } | null = null;
    void getCurrentDeviceLocation()
      .then((current) => {
        if (!active) return null;
        setDeviceLocation(current);
        return watchDeviceLocation(
          (next) => { if (active) { setDeviceLocation(next); setLocationError(null); } },
          (message) => { if (active) { setDeviceLocation(null); setLocationError(message); } },
        );
      })
      .then((nextSubscription) => {
        if (!nextSubscription) return;
        if (active) subscription = nextSubscription;
        else nextSubscription.remove();
      })
      .catch((error: unknown) => {
        if (active) setLocationError(getErrorMessage(error, 'Lokasi tidak dapat diperoleh. Aktifkan GPS lalu coba lagi.'));
      })
      .finally(() => { if (active) setCheckingLocation(false); });
    return () => { active = false; subscription?.remove(); };
  }, [session?.id, session?.labId, lab?.id]);

  useEffect(() => {
    if (!session?.labId) return undefined;

    return subscribeLab(
      session.labId,
      (nextLab) => {
        setLabSnapshot({
          labId: session.labId!,
          lab: nextLab,
          error: nextLab ? null : 'Data lab belum tersedia atau koordinat/radius belum valid.',
        });
      },
      (error) =>
        setLabSnapshot({
          labId: session.labId!,
          lab: null,
          error: getErrorMessage(error, 'Gagal memuat lokasi laboratorium.'),
        }),
    );
  }, [session?.labId]);

  const refreshLocation = useCallback(async () => {
    setCheckingLocation(true);
    setLocationError(null);
    setFeedback(null);
    try {
      const current = await getCurrentDeviceLocation();
      setDeviceLocation(current);
    } catch (error) {
      setDeviceLocation(null);
      setLocationError(getErrorMessage(error, 'Lokasi tidak dapat diperoleh. Aktifkan GPS lalu coba lagi.'));
    } finally {
      setCheckingLocation(false);
    }
  }, []);

  const distanceMeters = useMemo(() => {
    if (!deviceLocation || !lab) return null;
    return distanceInMeters(deviceLocation, lab);
  }, [deviceLocation, lab]);

  const blockReason = session ? getAttendanceBlockReason(session) : null;
  const insideRadius = distanceMeters !== null && lab !== null && distanceMeters <= lab.radiusMeters;
  const canSubmit = Boolean(
    profile &&
      session &&
      session.status === 'open' &&
      lab &&
      insideRadius &&
      !existingAttendance &&
      !permissionApproved,
  );

  useEffect(() => {
    if (!lab) return;
    const payload = JSON.stringify({
      lab: { latitude: lab.latitude, longitude: lab.longitude, name: lab.name, radiusMeters: lab.radiusMeters },
      device: deviceLocation,
    }).replace(/</g, '\\u003c');
    mapRef.current?.injectJavaScript(`window.updateAttendanceMap && window.updateAttendanceMap(${payload}); true;`);
  }, [deviceLocation, lab]);

  const handleSubmit = async () => {
    if (!profile || !session || submitting || !canSubmit) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const result = await submitAttendance(session.id);
      if (result.attendanceStatus === 'late') {
        const fine = result.fineAmount
          ? ` Tagihan denda ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(result.fineAmount)} akan muncul di halaman Tagihan.`
          : ' Periksa halaman Tagihan untuk melihat denda yang dibuat backend.';
        setSuccessModalMessage(`Presensi tercatat terlambat ${result.lateMinutes} menit.${fine}`);
      } else {
        setSuccessModalMessage('Presensi berhasil dicatat tepat waktu. Data kehadiranmu sudah tersimpan.');
      }
    } catch (error) {
      setFeedback(getErrorMessage(error, 'Presensi gagal. Periksa koneksi dan coba lagi.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!profile || profile.role !== 'praktikan') {
    return (
      <EmptyState
        icon="📍"
        title="Akses Praktikan Diperlukan"
        message="Masuk dengan akun praktikan untuk melakukan presensi."
        actionLabel="Kembali"
        onAction={() => router.back()}
      />
    );
  }

  if (!session) {
    return (
      <LoadingState
        title="Memuat halaman presensi..."
        message="Menyiapkan informasi sesi praktikum."
      />
    );
  }

  return (
    <View style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content}>
      <ConnectionBanner isOffline={isOffline} fromCache={fromCache} error={null} />
      {feedback ? <FeedbackBanner type="error" title="Presensi gagal" message={feedback} onClose={() => setFeedback(null)} /> : null}
      {labError ? <FeedbackBanner type="error" title="Lokasi lab gagal dimuat" message={labError} /> : null}
      {locationError ? (
        <View style={styles.feedbackGroup}>
          <FeedbackBanner type="error" title="Lokasi perangkat tidak tersedia" message={locationError} onClose={() => setLocationError(null)} />
          {locationError.includes('Pengaturan') ? <AppButton title="Buka Pengaturan Aplikasi" variant="ghost" onPress={() => void Linking.openSettings()} /> : null}
        </View>
      ) : null}
      {mapError ? <FeedbackBanner type="error" title="Peta presensi gagal dimuat" message={mapError} onClose={() => setMapError(null)} /> : null}

      <View style={styles.card}>
        <View style={styles.titleRow}>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>{session.practicalName}</Text>
            <Text style={styles.subtitle}>{session.className}</Text>
          </View>
          <StatusBadge status={session.status} />
        </View>
        <View style={styles.divider} />
        <InfoRow label="Tanggal" value={formatDate(session.date)} />
        <InfoRow label="Waktu" value={formatTimeRange(session.startTime, session.endTime)} />
        <InfoRow label="Laboratorium" value={lab?.name ?? session.labName ?? 'Belum ditautkan'} />
        {session.room ? <InfoRow label="Ruangan" value={session.room} /> : null}
      </View>

      <View style={styles.mapCard}>
        <View style={styles.mapHeader}><Text style={styles.sectionTitle}>Lokasi presensi</Text><Text style={styles.hint}>Posisi perangkat akan mengikuti pergerakan Anda.</Text></View>
        {lab && MAPS_KEY ? (
          <WebView ref={mapRef} style={styles.attendanceMap} originWhitelist={['*']} source={{ html: createAttendanceMapHtml(MAPS_KEY) }} javaScriptEnabled domStorageEnabled scrollEnabled={false} onMessage={(event) => setMapError(event.nativeEvent.data)} onError={(event) => setMapError(event.nativeEvent.description || 'Peta gagal dimuat. Periksa koneksi internet.')} onHttpError={(event) => setMapError(`Peta gagal dimuat (HTTP ${event.nativeEvent.statusCode}).`)} onLoadEnd={() => {
            const payload = JSON.stringify({ lab: { latitude: lab.latitude, longitude: lab.longitude, name: lab.name, radiusMeters: lab.radiusMeters }, device: deviceLocation }).replace(/</g, '\\u003c');
            mapRef.current?.injectJavaScript(`window.updateAttendanceMap && window.updateAttendanceMap(${payload}); true;`);
          }} />
        ) : <View style={styles.mapFallback}><Text style={styles.hint}>{lab ? 'Peta belum dapat ditampilkan karena Maps API key belum dikonfigurasi.' : 'Memuat lokasi laboratorium…'}</Text></View>}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Pemeriksaan lokasi</Text>
        {blockReason ? <Notice tone="warning" message={blockReason} /> : null}
        {permissionApproved ? (
          <Notice tone="warning" message="Pengajuan izin sesi ini sudah disetujui; presensi tidak tersedia." />
        ) : null}
        {existingAttendance ? (
          <Notice tone="success" message="Presensi untuk sesi ini sudah tercatat." />
        ) : null}
        {!labError && !lab ? <Text style={styles.hint}>Memuat data laboratorium...</Text> : null}
        {distanceMeters !== null && lab ? (
          <Notice
            tone={insideRadius ? 'success' : 'danger'}
            message={
              insideRadius
                ? `Di dalam radius: sekitar ${Math.round(distanceMeters)} m dari lab (batas ${lab.radiusMeters} m).`
                : `Di luar radius: sekitar ${Math.round(distanceMeters)} m dari lab (batas ${lab.radiusMeters} m).`
            }
          />
        ) : !blockReason && !locationError ? (
          <Text style={styles.hint}>Periksa lokasi untuk melihat jarak Anda dari laboratorium.</Text>
        ) : null}

        <AppButton
          title={checkingLocation ? 'Memeriksa lokasi...' : deviceLocation ? 'Periksa Lokasi Lagi' : 'Periksa Lokasi'}
          variant="secondary"
          disabled={checkingLocation || !lab}
          onPress={() => void refreshLocation()}
        />
        <AppButton
          testID="submit-location-attendance"
          title={submitting ? 'Mencatat Presensi...' : 'Presensi Sekarang'}
          disabled={!canSubmit || submitting}
          onPress={() => void handleSubmit()}
        />
      </View>
    </ScrollView>
    <Pressable
      testID="scan-attendance-qr-fab"
      accessibilityRole="button"
      accessibilityLabel="Scan QR presensi"
      onPress={() => router.push('/student/scan' as any)}
      style={({ pressed }) => [styles.qrFab, pressed && styles.qrFabPressed]}>
      <Text style={styles.qrFabIcon}>▦</Text>
      <Text style={styles.qrFabText}>Scan QR</Text>
    </Pressable>
    <AnimatedModal
      visible={successModalMessage !== null}
      variant="popup"
      onRequestClose={() => setSuccessModalMessage(null)}>
      <View style={styles.modalBackdrop}>
        <ModalMotion variant="popup" style={styles.successModal}>
        <View accessibilityViewIsModal>
          <View style={styles.successIcon}><Text style={styles.successIconText}>✓</Text></View>
          <Text style={styles.successTitle}>Presensi Berhasil</Text>
          <Text style={styles.successMessage}>{successModalMessage}</Text>
          <AppButton
            title="Kembali ke Beranda"
            onPress={() => {
              setSuccessModalMessage(null);
              router.replace('/student');
            }}
          />
        </View>
        </ModalMotion>
      </View>
    </AnimatedModal>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function Notice({ message, tone }: { message: string; tone: 'success' | 'warning' | 'danger' }) {
  const toneStyle = tone === 'success' ? styles.success : tone === 'warning' ? styles.warning : styles.danger;
  return (
    <View style={[styles.notice, toneStyle]}>
      <Text style={styles.noticeText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AppColors.background },
  qrFab: { position: 'absolute', right: Spacing.three, bottom: Spacing.three, minHeight: 54, borderRadius: Radius.pill, paddingHorizontal: Spacing.four, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: AppColors.primary, ...CardShadow },
  qrFabPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  qrFabIcon: { color: AppColors.textOnPrimary, fontSize: 22, fontWeight: '800' },
  qrFabText: { color: AppColors.textOnPrimary, fontSize: 14, fontWeight: '800' },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    padding: Spacing.three,
    paddingBottom: 104,
    gap: Spacing.three,
  },
  card: {
    backgroundColor: AppColors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: Spacing.four,
    gap: Spacing.three,
    ...CardShadow,
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  titleBlock: { flex: 1, gap: 4 },
  title: { fontSize: 21, fontWeight: '800', color: AppColors.text },
  subtitle: { fontSize: 14, color: AppColors.textMuted },
  divider: { height: 1, backgroundColor: AppColors.border },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: AppColors.text },
  mapCard: { backgroundColor: AppColors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: AppColors.border, padding: Spacing.three, gap: Spacing.two, ...CardShadow },
  mapHeader: { gap: 3 },
  feedbackGroup: { gap: Spacing.two },
  attendanceMap: { height: 260, borderRadius: Radius.md, overflow: 'hidden' },
  mapFallback: { height: 180, alignItems: 'center', justifyContent: 'center', padding: Spacing.three, backgroundColor: AppColors.background, borderRadius: Radius.md },
  mapError: { color: AppColors.danger, fontSize: 12, lineHeight: 18 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three },
  infoLabel: { fontSize: 13, color: AppColors.textMuted },
  infoValue: { flex: 1, textAlign: 'right', fontSize: 13, fontWeight: '600', color: AppColors.text },
  hint: { fontSize: 13, lineHeight: 19, color: AppColors.textMuted },
  notice: { padding: Spacing.three, borderRadius: Radius.md },
  success: { backgroundColor: AppColors.successSoft },
  warning: { backgroundColor: AppColors.warningSoft },
  danger: { backgroundColor: AppColors.dangerSoft },
  noticeText: { color: AppColors.text, fontSize: 13, lineHeight: 19 },
  modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.four, backgroundColor: AppColors.overlay },
  successModal: { width: '100%', maxWidth: 420, backgroundColor: AppColors.surface, borderRadius: Radius.xl, padding: Spacing.five, alignItems: 'center', gap: Spacing.three, ...CardShadow },
  successIcon: { width: 58, height: 58, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: AppColors.successSoft },
  successIconText: { color: AppColors.success, fontSize: 30, fontWeight: '800' },
  successTitle: { color: AppColors.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  successMessage: { color: AppColors.textMuted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
