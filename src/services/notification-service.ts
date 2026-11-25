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
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

import { AppError } from '@/services/errors';
import { getDb } from '@/services/firebase';
import { COLLECTIONS } from '@/services/firestore-schema';

export interface PushDispatchResult {
  tokenCount: number;
  acceptedCount: number;
  failedCount: number;
  warning: string | null;
}

export interface PracticePushMessage {
  title: string;
  body: string;
  data: { type: string; sessionId?: string };
}

const emptyPushResult = (warning: string): PushDispatchResult => ({
  tokenCount: 0,
  acceptedCount: 0,
  failedCount: 0,
  warning,
});

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

/**
 * Demo Spark: kirim push dari client asisten lewat Expo Push API setelah event
 * Firestore berhasil. Token tetap diambil dari users/{uid}.pushTokens.
 */
export async function notifyClassStudents(
  classId: string,
  message: PracticePushMessage,
): Promise<PushDispatchResult> {
  try {
    const members = await getDocs(
      query(collection(getDb(), COLLECTIONS.classMembers), where('classId', '==', classId)),
    );
    const studentIds = members.docs
      .map((snapshot) => snapshot.data().studentId)
      .filter((studentId): studentId is string => typeof studentId === 'string' && studentId.length > 0);
    return sendPushToUsers(studentIds, message);
  } catch {
    return emptyPushResult(
      'Data peserta/token tidak dapat dibaca. Periksa koneksi dan Firestore Rules untuk asisten.',
    );
  }
}

export async function notifyUsers(
  userIds: string[],
  message: PracticePushMessage,
): Promise<PushDispatchResult> {
  return sendPushToUsers(userIds, message);
}

async function sendPushToUsers(
  userIds: string[],
  message: PracticePushMessage,
): Promise<PushDispatchResult> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return emptyPushResult('Tidak ada pengguna tujuan untuk notifikasi ini.');

  const userSnapshots = await Promise.allSettled(
    ids.map((uid) => getDoc(doc(getDb(), COLLECTIONS.users, uid))),
  );
  const tokens = new Set<string>();
  let profileReadFailures = 0;
  for (const result of userSnapshots) {
    if (result.status === 'rejected') {
      profileReadFailures += 1;
      continue;
    }
    const values = result.value.data()?.pushTokens;
    if (Array.isArray(values)) {
      for (const token of values) {
        if (typeof token === 'string' && /^(Expo|Exponent)PushToken\[.+\]$/.test(token)) tokens.add(token);
      }
    }
  }

  const tokenList = [...tokens];
  if (tokenList.length === 0) {
    return emptyPushResult(
      profileReadFailures > 0
        ? 'Token tidak dapat dibaca. Firestore Rules mungkin belum mengizinkan asisten membaca profil peserta.'
        : 'Belum ada peserta yang mendaftarkan token push pada perangkatnya.',
    );
  }

  let acceptedCount = 0;
  let failedCount = 0;
  const warnings: string[] = [];
  if (profileReadFailures > 0) {
    warnings.push(`${profileReadFailures} profil/token tidak dapat dibaca oleh akun asisten.`);
  }
  try {
    for (let offset = 0; offset < tokenList.length; offset += 100) {
      const chunk = tokenList.slice(offset, offset + 100);
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(
          chunk.map((to) => ({
            to,
            title: message.title,
            body: message.body,
            data: message.data,
            sound: 'default',
            priority: 'high',
          })),
        ),
      });
      const result = (await response.json()) as {
        data?: { status?: string }[];
        errors?: unknown[];
      };
      if (!response.ok || !Array.isArray(result.data)) {
        failedCount += chunk.length;
        continue;
      }
      acceptedCount += result.data.filter((ticket) => ticket.status === 'ok').length;
      failedCount += result.data.filter((ticket) => ticket.status !== 'ok').length;
      failedCount += result.errors?.length ?? 0;
    }
  } catch {
    failedCount = tokenList.length - acceptedCount;
  }
  if (failedCount > 0) {
    warnings.push(`${acceptedCount} notifikasi diterima Expo, ${failedCount} gagal dikirim ke layanan push.`);
  }

  return {
    tokenCount: tokenList.length,
    acceptedCount,
    failedCount,
    warning: warnings.length > 0 ? warnings.join(' ') : null,
  };
}
