import MapView, { Circle, Marker, type Region } from 'react-native-maps';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { EmptyState } from '@/components/EmptyState';
import { LoadingState } from '@/components/LoadingState';
import { AppColors, CardShadow, Radius } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useStudentData } from '@/context/StudentDataContext';
import { getErrorMessage } from '@/services/errors';
import { getCurrentDeviceLocation, watchDeviceLocation } from '@/services/location-service';
import { subscribeLabs } from '@/services/student-data-service';
import type { Lab, PracticeSession } from '@/types';
import type { Coordinates } from '@/utils/distance';
import { nowLocalDateTime, formatDate, formatTimeRange } from '@/utils/format';

const FALLBACK_REGION: Region = {
  latitude: -7.049,
  longitude: 110.438004,
  latitudeDelta: 0.025,
  longitudeDelta: 0.025,
};

export default function StudentLabsMapScreen() {
  const { profile } = useAuth();
  const { sessions } = useStudentData();
  const mapRef = useRef<MapView | null>(null);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [labsLoading, setLabsLoading] = useState(true);
  const [labsError, setLabsError] = useState<string | null>(null);
  const [selectedLabId, setSelectedLabId] = useState<string | null>(null);
  const [deviceLocation, setDeviceLocation] = useState<Coordinates | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationRetryKey, setLocationRetryKey] = useState(0);

  const selectedLab = labs.find((lab) => lab.id === selectedLabId) ?? labs[0] ?? null;
  const selectedMapLabId = selectedLab?.id;
  const selectedLatitude = selectedLab?.latitude;
  const selectedLongitude = selectedLab?.longitude;

  useEffect(() => {
    return subscribeLabs(
      (nextLabs) => {
        setLabs(nextLabs);
        setLabsLoading(false);
        setLabsError(null);
      },
      (error) => {
        setLabsLoading(false);
        setLabsError(getErrorMessage(error, 'Gagal memuat laboratorium dari Firestore.'));
      },
    );
  }, []);

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
    if (
      !selectedMapLabId ||
      selectedLatitude === undefined ||
      selectedLongitude === undefined
    ) {
      return;
    }
    mapRef.current?.animateToRegion(
      {
        latitude: selectedLatitude,
        longitude: selectedLongitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      },
      350,
    );
  }, [selectedMapLabId, selectedLatitude, selectedLongitude]);

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

  const initialRegion: Region =
    selectedLatitude !== undefined && selectedLongitude !== undefined
      ? {
          latitude: selectedLatitude,
          longitude: selectedLongitude,
          latitudeDelta: 0.025,
          longitudeDelta: 0.025,
        }
      : deviceLocation
        ? {
            latitude: deviceLocation.latitude,
            longitude: deviceLocation.longitude,
            latitudeDelta: 0.025,
            longitudeDelta: 0.025,
          }
        : FALLBACK_REGION;

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
    return <LoadingState title="Memuat peta laboratorium..." message="Mengambil lokasi lab dari Firestore." />;
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {labsError ? <Text style={styles.errorMessage}>{labsError}</Text> : null}
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
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={initialRegion}
          showsCompass
          showsScale
          toolbarEnabled={false}>
          {labs.map((lab) => (
            <Marker
              key={lab.id}
              coordinate={{ latitude: lab.latitude, longitude: lab.longitude }}
              title={lab.name}
              description={lab.building}
              onPress={() => setSelectedLabId(lab.id)}
              pinColor={lab.id === selectedLab?.id ? AppColors.primary : undefined}
            />
          ))}
          {selectedLab ? (
            <Circle
              center={{ latitude: selectedLab.latitude, longitude: selectedLab.longitude }}
              radius={selectedLab.radiusMeters}
              strokeColor="rgba(79, 70, 229, 0.8)"
              fillColor="rgba(79, 70, 229, 0.12)"
            />
          ) : null}
          {deviceLocation ? (
            <Marker
              coordinate={deviceLocation}
              title="Lokasi Anda"
              description="Posisi diperbarui selama halaman peta terbuka."
              pinColor="#15803D"
            />
          ) : null}
        </MapView>
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
