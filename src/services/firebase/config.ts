import type { FirebaseOptions } from 'firebase/app';

/**
 * Konfigurasi Firebase client dibaca dari environment variable `EXPO_PUBLIC_*`
 * (lihat `.env.example`). Nilai asli disimpan di file `.env` lokal yang
 * di-ignore git — JANGAN menulis nilai konfigurasi langsung di source code.
 *
 * Catatan: variabel `EXPO_PUBLIC_*` di-inline ke bundle aplikasi saat build,
 * jadi hanya konfigurasi client (bukan service account / admin key) yang
 * boleh diletakkan di sini. Keamanan data dijaga oleh Firebase Security Rules.
 *
 * Expo hanya meng-inline variabel bila diakses dengan notasi titik
 * `process.env.EXPO_PUBLIC_X` secara statis, sehingga setiap key ditulis eksplisit.
 */
const firebaseEnv = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const REQUIRED_KEYS: { key: keyof typeof firebaseEnv; envName: string }[] = [
  { key: 'apiKey', envName: 'EXPO_PUBLIC_FIREBASE_API_KEY' },
  { key: 'authDomain', envName: 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN' },
  { key: 'projectId', envName: 'EXPO_PUBLIC_FIREBASE_PROJECT_ID' },
  { key: 'appId', envName: 'EXPO_PUBLIC_FIREBASE_APP_ID' },
];

/** Daftar nama env var wajib yang belum diisi. */
export const missingFirebaseEnv: string[] = REQUIRED_KEYS.filter(({ key }) => !firebaseEnv[key]).map(
  ({ envName }) => envName,
);

export const isFirebaseConfigured = missingFirebaseEnv.length === 0;

export const firebaseOptions: FirebaseOptions = firebaseEnv;

/**
 * Konfigurasi API AI klasifikasi alasan izin (disediakan pengajar).
 * Bersifat opsional: bila URL kosong, klasifikasi dilewati (`skipped`) dan
 * pengajuan tetap tersimpan.
 */
export const aiClassifierConfig = {
  url: process.env.EXPO_PUBLIC_AI_CLASSIFIER_URL ?? '',
  apiKey: process.env.EXPO_PUBLIC_AI_CLASSIFIER_API_KEY ?? '',
  timeoutMs: Number(process.env.EXPO_PUBLIC_AI_CLASSIFIER_TIMEOUT_MS ?? 10000) || 10000,
};

