import * as Location from 'expo-location';

import { AppError, withTimeout } from '@/services/errors';
import type { Coordinates } from '@/utils/distance';

const LOCATION_TIMEOUT_MS = 15000;

/** Meminta izin foreground dan membaca koordinat terkini perangkat. */
export async function getCurrentDeviceLocation(): Promise<Coordinates> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    const message = permission.canAskAgain
      ? 'Izin lokasi diperlukan untuk presensi. Izinkan akses lokasi lalu coba lagi.'
      : 'Izin lokasi dinonaktifkan. Aktifkan izin aplikasi melalui Pengaturan perangkat.';
    throw new AppError('location-permission-denied', message);
  }

  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    throw new AppError('location-services-disabled', 'Layanan lokasi/GPS mati. Aktifkan lalu coba lagi.');
  }

  try {
    const position = await withTimeout(
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        mayShowUserSettingsDialog: true,
      }),
      LOCATION_TIMEOUT_MS,
      'Lokasi belum berhasil diperoleh. Pastikan GPS aktif dan coba lagi.',
    );

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('location-unavailable', 'Lokasi perangkat tidak tersedia. Aktifkan GPS lalu coba lagi.');
  }
}
