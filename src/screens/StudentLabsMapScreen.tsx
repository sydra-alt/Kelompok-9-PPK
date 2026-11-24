import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { AppButton } from '@/components/AppButton';
import { EmptyState } from '@/components/EmptyState';
import { LoadingState } from '@/components/LoadingState';
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

        const selectedLab = labs.find((lab) => lab.id === data.selectedLabId) || labs[0];
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

  const selectedLab = labs.find((lab) => lab.id === selectedLabId) ?? labs[0] ?? null;
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
        setLabsError(getErrorMessage(error, 'Gagal memuat laboratorium dari Firestore.'));
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

  if (labsLoading && labs.length === 0) {
    return (
      <View style={styles.loadingScreen}>
        <ConnectionBanner
          isOffline={isOffline}
          fromCache={fromCache || labsFromCache}
          error={labsError ?? studentDataError}
          onRetry={retryMapData}
        />
        <LoadingState title="Memuat peta laboratorium..." message="Mengambil lokasi lab dari Firestore." />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <ConnectionBanner
        isOffline={isOffline}
        fromCache={fromCache || labsFromCache}
        error={labsError ?? studentDataError}
        onRetry={retryMapData}
      />
      {locationError ? (
        <View style={styles.locationNotice}>
          <Text style={styles.noticeText}>{locationError}</Text>
          <AppButton
            title="Coba Deteksi Lokasi Lagi"
            variant="secondary"
            onPress={() => setLocationRetryKey((key) => key + 1)}
          />
          <AppButton title="Buka Pengaturan Aplikasi" variant="ghost" onPress={() => void Linking.openSettings()} />
        </View>
      ) : null}

      <View style={styles.mapFrame}>
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
          <View style={styles.mapFallback}>
            <Text style={styles.mapErrorText}>Maps Demo Key belum tersedia pada konfigurasi aplikasi.</Text>
          </View>
        )}
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
      </View>

      {labs.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Belum ada laboratorium</Text>
          <Text style={styles.bodyText}>Tambahkan dokumen pada koleksi `labs` untuk menampilkan marker.</Text>
        </View>
      ) : selectedLab ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{selectedLab.name}</Text>
          <Text style={styles.bodyText}>
            {selectedLab.building ? `${selectedLab.building} · ` : ''}Radius presensi {selectedLab.radiusMeters} m
          </Text>
          {selectedLab.description ? <Text style={styles.bodyText}>{selectedLab.description}</Text> : null}

          <View style={styles.divider} />
          <Text style={styles.activityHeading}>Praktikum sedang berlangsung</Text>
          {activity.active.length > 0 ? (
            activity.active.map((session) => (
              <ActivityRow key={session.id} session={session} statusLabel="Dibuka" />
            ))
          ) : (
            <Text style={styles.bodyText}>Tidak ada sesi yang sedang dibuka.</Text>
          )}

          <View style={styles.divider} />
          <Text style={styles.activityHeading}>Praktikum berikutnya</Text>
          {activity.next ? (
            <ActivityRow session={activity.next} statusLabel="Terjadwal" />
          ) : (
            <Text style={styles.bodyText}>Belum ada sesi terjadwal berikutnya untuk lab ini.</Text>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

function ActivityRow({ session, statusLabel }: { session: PracticeSession; statusLabel: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/student/session/[sessionId]', params: { sessionId: session.id } })}
      style={({ pressed }) => [styles.activityRow, pressed && styles.pressed]}>
      <View style={styles.activityText}>
        <Text style={styles.activityName}>{session.practicalName} · {session.className}</Text>
        <Text style={styles.bodyText}>
          {formatDate(session.date)} · {formatTimeRange(session.startTime, session.endTime)}
        </Text>
      </View>
      <Text style={styles.statusText}>{statusLabel}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: AppColors.background,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  content: {
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  mapFrame: {
    height: 400,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  map: { flex: 1 },
  mapFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.three },
  mapErrorOverlay: {
    position: 'absolute',
    left: Spacing.two,
    right: Spacing.two,
    top: Spacing.two,
    padding: Spacing.two,
    gap: Spacing.two,
    backgroundColor: AppColors.surface,
    borderRadius: Radius.md,
  },
  mapErrorText: { color: AppColors.danger, fontSize: 13, lineHeight: 19 },
  card: {
    backgroundColor: AppColors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: Spacing.four,
    gap: Spacing.three,
    ...CardShadow,
  },
  sectionTitle: { color: AppColors.text, fontSize: 19, fontWeight: '800' },
  activityHeading: { color: AppColors.text, fontSize: 15, fontWeight: '700' },
  bodyText: { color: AppColors.textMuted, fontSize: 13, lineHeight: 19 },
  divider: { height: 1, backgroundColor: AppColors.border },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.one },
  activityText: { flex: 1, gap: 3 },
  activityName: { color: AppColors.text, fontSize: 14, fontWeight: '700' },
  statusText: { color: AppColors.primary, fontSize: 12, fontWeight: '700' },
  locationNotice: { gap: Spacing.two, padding: Spacing.three, backgroundColor: AppColors.warningSoft, borderRadius: Radius.md },
  noticeText: { color: AppColors.text, fontSize: 13, lineHeight: 19 },
  errorMessage: { color: AppColors.danger, fontSize: 13, lineHeight: 19 },
  pressed: { opacity: 0.75 },
});
