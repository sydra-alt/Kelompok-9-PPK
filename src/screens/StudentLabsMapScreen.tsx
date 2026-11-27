import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { AnimatedModal, ModalMotion } from '@/components/ModalMotion';
import { EmptyState } from '@/components/EmptyState';
import { AppColors, CardShadow, Radius } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useStudentData } from '@/context/StudentDataContext';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { getErrorMessage } from '@/services/errors';
import { getCurrentDeviceLocation, watchDeviceLocation } from '@/services/location-service';
import { subscribeLabs } from '@/services/student-data-service';
import type { Lab, PracticeSession } from '@/types';
import type { Coordinates } from '@/utils/distance';
import { nowLocalDateTime, formatDate, formatTimeRange } from '@/utils/format';

const GOOGLE_MAPS_API_KEY = Constants.expoConfig?.extra?.googleMapsApiKey;

function createGoogleMapsHtml(apiKey: string) {
  const scriptUrl = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=initMap&loading=async`;

  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <meta name="color-scheme" content="light" />
    <style>
      html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; }
      body { background: #f1f5f9; font-family: Arial, sans-serif; }
    </style>
  </head>
  <body>
    <div id="map" aria-label="Peta laboratorium"></div>
    <script>
      let map;
      let labMarkers = new Map();
      let userMarker = null;
      let attendanceCircle = null;
      let previousSelectedLabId = null;

      function sendMessage(message) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(message));
        }
      }

      window.gm_authFailure = function () {
        sendMessage({ type: 'error', message: 'Google menolak Maps Demo Key untuk konfigurasi peta ini. Pastikan key mendukung Maps JavaScript API dan kuota harian belum habis.' });
      };

      window.initMap = function () {
        map = new google.maps.Map(document.getElementById('map'), {
          center: { lat: -7.05436, lng: 110.43553 },
          zoom: 15,
          clickableIcons: false,
          fullscreenControl: false,
          mapTypeControl: false,
          streetViewControl: false,
          gestureHandling: 'greedy'
        });
        sendMessage({ type: 'ready' });
      };

      window.updateMapData = function (data) {
        if (!map) return;
        const labs = Array.isArray(data.labs) ? data.labs : [];
        const nextIds = new Set(labs.map((lab) => lab.id));

        for (const [id, marker] of labMarkers.entries()) {
          if (!nextIds.has(id)) {
            marker.setMap(null);
            labMarkers.delete(id);
          }
        }

        for (const lab of labs) {
          const position = { lat: lab.latitude, lng: lab.longitude };
          let marker = labMarkers.get(lab.id);
          if (!marker) {
            marker = new google.maps.Marker({ map, position, title: lab.name });
            marker.addListener('click', () => sendMessage({ type: 'selectLab', labId: lab.id }));
            labMarkers.set(lab.id, marker);
          } else {
            marker.setPosition(position);
            marker.setTitle(lab.name);
          }
          marker.setIcon(lab.id === data.selectedLabId
            ? 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'
            : null);
        }

        const selectedLab = labs.find((lab) => lab.id === data.selectedLabId);
        if (attendanceCircle) attendanceCircle.setMap(null);
        if (selectedLab) {
          const center = { lat: selectedLab.latitude, lng: selectedLab.longitude };
          attendanceCircle = new google.maps.Circle({
            map,
            center,
            radius: selectedLab.radiusMeters,
            strokeColor: '#4f46e5',
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: '#4f46e5',
            fillOpacity: 0.12,
            clickable: false
          });
          if (previousSelectedLabId !== selectedLab.id) {
            map.panTo(center);
            map.setZoom(16);
          }
          previousSelectedLabId = selectedLab.id;
        }

        if (data.deviceLocation) {
          const position = { lat: data.deviceLocation.latitude, lng: data.deviceLocation.longitude };
          if (!userMarker) {
            userMarker = new google.maps.Marker({
              map,
              position,
              title: 'Lokasi Anda',
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#15803d',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2
              },
              zIndex: 1000
            });
          } else {
            userMarker.setPosition(position);
          }
        } else if (userMarker) {
          userMarker.setMap(null);
          userMarker = null;
        }
      };

      const mapsScript = document.createElement('script');
      mapsScript.src = ${JSON.stringify(scriptUrl)};
      mapsScript.async = true;
      mapsScript.onerror = function () {
        sendMessage({ type: 'error', message: 'Google Maps JavaScript API gagal dimuat. Periksa koneksi internet dan Maps Demo Key.' });
      };
      document.head.appendChild(mapsScript);
    </script>
  </body>
</html>`;
}

export default function StudentLabsMapScreen() {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const { sessions, error: studentDataError, fromCache, isOffline, retry } = useStudentData();
  const mapRef = useRef<WebView<object> | null>(null);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [labsLoading, setLabsLoading] = useState(true);
  const [labsError, setLabsError] = useState<string | null>(null);
  const [labsFromCache, setLabsFromCache] = useState(false);
  const [labsRetryKey, setLabsRetryKey] = useState(0);
  const [selectedLabId, setSelectedLabId] = useState<string | null>(null);
  const [deviceLocation, setDeviceLocation] = useState<Coordinates | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationRetryKey, setLocationRetryKey] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReloadKey, setMapReloadKey] = useState(0);

  const selectedLab = labs.find((lab) => lab.id === selectedLabId) ?? null;
  const selectedMapLabId = selectedLab?.id;
  useEffect(() => {
    return subscribeLabs(
      (nextLabs, meta) => {
        setLabs(nextLabs);
        setLabsFromCache(meta.fromCache);
        setLabsLoading(false);
        setLabsError(null);
      },
      (error) => {
        setLabsLoading(false);
        setLabsError(getErrorMessage(error, 'Daftar laboratorium tidak dapat dimuat. Coba lagi.'));
      },
    );
  }, [labsRetryKey]);

  useEffect(() => {
    let active = true;
    let subscription: { remove: () => void } | null = null;

    void getCurrentDeviceLocation()
      .then((current) => {
        if (!active) return null;
        setDeviceLocation(current);
        setLocationError(null);
        return watchDeviceLocation(
          (next) => {
            if (active) setDeviceLocation(next);
          },
          (message) => {
            if (active) setLocationError(message);
          },
        );
      })
      .then((nextSubscription) => {
        if (!nextSubscription) return;
        if (active) subscription = nextSubscription;
        else nextSubscription.remove();
      })
      .catch((error: unknown) => {
        if (active) setLocationError(getErrorMessage(error, 'Lokasi perangkat tidak tersedia.'));
      });

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [locationRetryKey]);

  useEffect(() => {
    if (!mapReady) return;
    const payload = JSON.stringify({
      labs: labs.map((lab) => ({
        id: lab.id,
        name: lab.name,
        latitude: lab.latitude,
        longitude: lab.longitude,
        radiusMeters: lab.radiusMeters,
      })),
      selectedLabId: selectedMapLabId ?? null,
      deviceLocation,
    }).replace(/</g, '\\u003c');
    mapRef.current?.injectJavaScript(`window.updateMapData && window.updateMapData(${payload}); true;`);
  }, [deviceLocation, labs, mapReady, selectedLabId, selectedMapLabId]);

  const handleMapMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as { type?: string; labId?: string; message?: string };
      if (message.type === 'ready') {
        setMapError(null);
        setMapReady(true);
      } else if (message.type === 'selectLab' && typeof message.labId === 'string') {
        setSelectedLabId(message.labId);
      } else if (message.type === 'error') {
        setMapError(message.message ?? 'Google Maps gagal dimuat.');
      }
    } catch {
      setMapError('Respons dari peta tidak dapat dibaca. Muat ulang peta lalu coba lagi.');
    }
  };

  const activity = useMemo(() => {
    if (!selectedLab) return { active: [], next: null };
    const related = sessions.filter((session) => session.labId === selectedLab.id);
    const active = related.filter((session) => session.status === 'open');
    const currentTime = nowLocalDateTime().slice(0, 16);
    const next = related
      .filter(
        (session) =>
          session.status === 'scheduled' && `${session.date}T${session.startTime}` >= currentTime,
      )
      .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))[0] ?? null;
    return { active, next };
  }, [selectedLab, sessions]);

  const retryMapData = () => {
    setLabsError(null);
    setLabsLoading(true);
    setLabsRetryKey((key) => key + 1);
    retry();
  };

  if (!profile || profile.role !== 'praktikan') {
    return (
      <EmptyState
        icon="🗺️"
        title="Akses Praktikan Diperlukan"
        message="Masuk dengan akun praktikan untuk melihat peta laboratorium."
        actionLabel="Kembali"
        onAction={() => router.back()}
      />
    );
  }

  return (
    <View style={styles.screen}>
      {GOOGLE_MAPS_API_KEY ? (
        <WebView<object>
          key={mapReloadKey}
          ref={mapRef}
          style={styles.map}
          originWhitelist={['*']}
          source={{ html: createGoogleMapsHtml(GOOGLE_MAPS_API_KEY) }}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
          onMessage={handleMapMessage}
          onError={(event) => setMapError(event.nativeEvent.description || 'WebView gagal memuat peta.')}
          onHttpError={(event) => setMapError(`Peta gagal dimuat (HTTP ${event.nativeEvent.statusCode}).`)}
        />
      ) : (
        <View style={[styles.mapFallback, StyleSheet.absoluteFill]}>
          <Text style={styles.mapErrorText}>Maps Demo Key belum tersedia pada konfigurasi aplikasi.</Text>
        </View>
      )}

      <View pointerEvents="box-none" style={styles.topOverlay}>
        <ConnectionBanner
          isOffline={isOffline}
          fromCache={fromCache || labsFromCache}
          error={labsError ?? studentDataError}
          onRetry={retryMapData}
        />
        {labsLoading && labs.length === 0 ? (
          <View style={styles.statusPill}>
            <ActivityIndicator size="small" color={AppColors.primary} />
            <Text style={styles.statusPillText}>Memuat laboratorium...</Text>
          </View>
        ) : null}
        {locationError ? (
          <View style={styles.locationNotice}>
            <Text style={styles.noticeText}>{locationError}</Text>
            <View style={styles.noticeActions}>
              <AppButton
                title="Coba Lagi"
                variant="secondary"
                onPress={() => setLocationRetryKey((key) => key + 1)}
              />
              <AppButton
                title="Pengaturan"
                variant="ghost"
                onPress={() => void Linking.openSettings()}
              />
            </View>
          </View>
        ) : null}
      </View>

      {!labsLoading && labs.length === 0 ? (
        <View style={styles.emptyLabs}>
          <Text style={styles.sectionTitle}>Belum ada laboratorium</Text>
          <Text style={styles.bodyText}>Tambahkan dokumen pada koleksi `labs` untuk menampilkan marker.</Text>
        </View>
      ) : null}

      {!labsLoading && labs.length > 0 && !selectedLab ? (
        <View style={styles.mapHint} pointerEvents="none">
          <Text style={styles.mapHintText}>Ketuk marker untuk melihat informasi laboratorium</Text>
        </View>
      ) : null}

      {mapError ? (
        <View style={styles.mapErrorOverlay}>
          <Text style={styles.mapErrorText}>{mapError}</Text>
          <AppButton
            title="Muat Ulang Peta"
            variant="secondary"
            onPress={() => {
              setMapError(null);
              setMapReady(false);
              setMapReloadKey((key) => key + 1);
            }}
          />
        </View>
      ) : null}

      <AnimatedModal
        visible={Boolean(selectedLab)}
        variant="sheet"
        onRequestClose={() => setSelectedLabId(null)}>
        <View style={styles.sheetRoot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tutup informasi laboratorium"
            style={styles.sheetBackdrop}
            onPress={() => setSelectedLabId(null)}
          />
          {selectedLab ? (
            <ModalMotion variant="sheet" style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.four) }]}>
            <View>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <View style={styles.sheetTitleBlock}>
                  <Text style={styles.sectionTitle}>{selectedLab.name}</Text>
                  <Text style={styles.bodyText}>
                    {selectedLab.building ? `${selectedLab.building} · ` : ''}
                    Radius presensi {selectedLab.radiusMeters} m
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Tutup"
                  onPress={() => setSelectedLabId(null)}
                  style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>×</Text>
                </Pressable>
              </View>
              <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetContent}>
                {selectedLab.description ? <Text style={styles.bodyText}>{selectedLab.description}</Text> : null}

                <View style={styles.divider} />
                <Text style={styles.activityHeading}>Praktikum sedang berlangsung</Text>
                {activity.active.length > 0 ? (
                  activity.active.map((session) => (
                    <ActivityRow
                      key={session.id}
                      session={session}
                      statusLabel="Dibuka"
                      onPress={() => {
                        setSelectedLabId(null);
                        router.push({ pathname: '/student/session/[sessionId]', params: { sessionId: session.id } });
                      }}
                    />
                  ))
                ) : (
                  <Text style={styles.bodyText}>Tidak ada sesi yang sedang dibuka.</Text>
                )}

                <View style={styles.divider} />
                <Text style={styles.activityHeading}>Praktikum berikutnya</Text>
                {activity.next ? (
                  <ActivityRow
                    session={activity.next}
                    statusLabel="Terjadwal"
                    onPress={() => {
                      setSelectedLabId(null);
                      router.push({ pathname: '/student/session/[sessionId]', params: { sessionId: activity.next!.id } });
                    }}
                  />
                ) : (
                  <Text style={styles.bodyText}>Belum ada sesi terjadwal berikutnya untuk lab ini.</Text>
                )}
              </ScrollView>
            </View>
            </ModalMotion>
          ) : null}
        </View>
      </AnimatedModal>
    </View>
  );
}

function ActivityRow({
  session,
  statusLabel,
  onPress,
}: {
  session: PracticeSession;
  statusLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.activityRow, pressed && styles.pressed]}>
      <View style={styles.activityText}>
        <Text style={styles.activityName}>{session.practicalName} · {session.className}</Text>
        <Text style={styles.bodyText}>
          {formatDate(session.date)} · {formatTimeRange(session.startTime, session.endTime)}
        </Text>
      </View>
      <Text style={styles.sessionStatusText}>{statusLabel}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AppColors.background },
  map: { ...StyleSheet.absoluteFill },
  mapFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.three },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: Spacing.three,
    right: Spacing.three,
    gap: Spacing.two,
  },
  statusPill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    backgroundColor: AppColors.surface,
    ...CardShadow,
  },
  statusPillText: { color: AppColors.text, fontSize: 12, fontWeight: '700' },
  emptyLabs: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    bottom: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
    backgroundColor: AppColors.surface,
    borderRadius: Radius.lg,
    ...CardShadow,
  },
  mapHint: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    backgroundColor: AppColors.surface,
    ...CardShadow,
  },
  mapHintText: { color: AppColors.text, fontSize: 12, fontWeight: '700' },
  mapErrorOverlay: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    top: '40%',
    padding: Spacing.three,
    gap: Spacing.two,
    backgroundColor: AppColors.surface,
    borderRadius: Radius.lg,
    ...CardShadow,
  },
  mapErrorText: { color: AppColors.danger, fontSize: 13, lineHeight: 19 },
  sectionTitle: { color: AppColors.text, fontSize: 19, fontWeight: '800' },
  activityHeading: { color: AppColors.text, fontSize: 15, fontWeight: '700' },
  bodyText: { color: AppColors.textMuted, fontSize: 13, lineHeight: 19 },
  divider: { height: 1, backgroundColor: AppColors.border },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.one },
  activityText: { flex: 1, gap: 3 },
  activityName: { color: AppColors.text, fontSize: 14, fontWeight: '700' },
  sessionStatusText: { color: AppColors.primary, fontSize: 12, fontWeight: '700' },
  locationNotice: {
    gap: Spacing.two,
    padding: Spacing.three,
    backgroundColor: AppColors.surface,
    borderRadius: Radius.md,
    ...CardShadow,
  },
  noticeText: { color: AppColors.text, fontSize: 13, lineHeight: 19 },
  noticeActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  pressed: { opacity: 0.75 },
  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: AppColors.overlay,
  },
  sheet: {
    maxHeight: '78%',
    backgroundColor: AppColors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    gap: Spacing.three,
    ...CardShadow,
  },
  sheetHandle: {
    width: 42,
    height: 5,
    borderRadius: Radius.pill,
    alignSelf: 'center',
    backgroundColor: AppColors.border,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  sheetTitleBlock: { flex: 1, gap: Spacing.one },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.background,
  },
  closeButtonText: { color: AppColors.text, fontSize: 26, lineHeight: 29 },
  sheetScroll: { flexGrow: 0 },
  sheetContent: { gap: Spacing.three, paddingBottom: Spacing.two },
});
