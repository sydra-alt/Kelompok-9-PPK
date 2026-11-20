import Constants from 'expo-constants';
import * as Device from 'expo-device';
import {
  AndroidImportance,
  getExpoPushTokenAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  setNotificationChannelAsync,
} from 'expo-notifications';
import { Platform } from 'react-native';
import { arrayRemove, arrayUnion, doc, serverTimestamp, updateDoc } from 'firebase/firestore';

import { AppError } from '@/services/errors';
import { getDb } from '@/services/firebase';
import { COLLECTIONS } from '@/services/firestore-schema';

/**
 * Mendaftarkan Expo Push Token pada `users/{uid}.pushTokens`.
 * Format ini menjadi kontrak client/server untuk pengiriman notifikasi Sprint 3.
 */
export async function registerPushToken(userId: string): Promise<string> {
  if (Platform.OS === 'web') {
    throw new AppError('notifications-unsupported', 'Push notification tersedia pada aplikasi Android dan iOS.');
  }
  if (!Device.isDevice) {
    throw new AppError('notifications-device-required', 'Pendaftaran push notification harus dilakukan di perangkat fisik.');
  }

  if (Platform.OS === 'android') {
    await setNotificationChannelAsync('default', {
      name: 'Informasi Praktikum',
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4F46E5',
    });
  }

  const currentPermission = await getPermissionsAsync();
  const permission =
    currentPermission.status === 'granted'
      ? currentPermission
      : await requestPermissionsAsync();

  if (permission.status !== 'granted') {
    const message = permission.canAskAgain
      ? 'Izin notifikasi diperlukan. Izinkan notifikasi lalu coba lagi.'
      : 'Izin notifikasi dinonaktifkan. Aktifkan melalui Pengaturan aplikasi.';
    throw new AppError('notifications-permission-denied', message);
  }

  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    throw new AppError('notifications-project-id-missing', 'Project ID Expo belum tersedia untuk pendaftaran token.');
  }

  let token: string;
  try {
    token = (await getExpoPushTokenAsync({ projectId })).data;
  } catch {
    throw new AppError('notifications-token-failed', 'Token push gagal didaftarkan. Periksa koneksi lalu coba lagi.');
  }

  try {
    await updateDoc(doc(getDb(), COLLECTIONS.users, userId), {
      pushTokens: arrayUnion(token),
      pushTokenUpdatedAt: serverTimestamp(),
    });
  } catch {
    throw new AppError(
      'notifications-token-save-failed',
      'Token berhasil dibuat, tetapi gagal disimpan ke akun. Periksa koneksi dan aturan Firestore.',
    );
  }

  return token;
}

/** Best-effort removal of this device token before the current account signs out. */
export async function unregisterPushToken(userId: string): Promise<void> {
  try {
    if (Platform.OS === 'web' || !Device.isDevice) return;
    const permission = await getPermissionsAsync();
    if (permission.status !== 'granted') return;

    if (Platform.OS === 'android') {
      await setNotificationChannelAsync('default', {
        name: 'Informasi Praktikum',
        importance: AndroidImportance.HIGH,
      });
    }

    const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return;
    const token = (await getExpoPushTokenAsync({ projectId })).data;
    await updateDoc(doc(getDb(), COLLECTIONS.users, userId), {
      pushTokens: arrayRemove(token),
      pushTokenUpdatedAt: serverTimestamp(),
    });
  } catch {
    // Token cleanup must not prevent the user from signing out.
  }
}
