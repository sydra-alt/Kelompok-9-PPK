import { FirebaseError } from 'firebase/app';

import { FirebaseConfigError } from '@/services/firebase';

/**
 * Error domain aplikasi dengan pesan yang siap ditampilkan ke pengguna.
 * Service melempar `AppError`; layar cukup menampilkan `getErrorMessage(err)`.
 */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

const AUTH_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'Format email tidak valid.',
  'auth/missing-email': 'Email wajib diisi.',
  'auth/missing-password': 'Kata sandi wajib diisi.',
  'auth/invalid-credential': 'Email atau kata sandi salah.',
  'auth/invalid-login-credentials': 'Email atau kata sandi salah.',
  'auth/wrong-password': 'Email atau kata sandi salah.',
  'auth/user-not-found': 'Akun dengan email tersebut tidak ditemukan.',
  'auth/user-disabled': 'Akun ini telah dinonaktifkan. Hubungi asisten/pengajar.',
  'auth/email-already-in-use': 'Email sudah terdaftar. Silakan masuk atau gunakan email lain.',
  'auth/weak-password': 'Kata sandi terlalu lemah. Gunakan minimal 6 karakter.',
  'auth/too-many-requests': 'Terlalu banyak percobaan. Tunggu beberapa saat lalu coba lagi.',
  'auth/network-request-failed': 'Tidak dapat terhubung ke server. Periksa koneksi internet kamu.',
  'auth/operation-not-allowed': 'Metode login email/kata sandi belum diaktifkan di Firebase.',
  'auth/invalid-api-key': 'Konfigurasi Firebase tidak valid (API key salah).',
};

const FIRESTORE_MESSAGES: Record<string, string> = {
  'permission-denied': 'Akses ditolak. Kamu tidak memiliki izin untuk data ini.',
  unavailable: 'Server tidak dapat dijangkau. Periksa koneksi internet lalu coba lagi.',
  'deadline-exceeded': 'Permintaan terlalu lama. Periksa koneksi internet lalu coba lagi.',
  'not-found': 'Data tidak ditemukan.',
  'failed-precondition': 'Operasi tidak dapat dijalankan (indeks/konfigurasi Firestore belum siap).',
  aborted: 'Terjadi konflik data. Silakan coba lagi.',
  unauthenticated: 'Sesi login berakhir. Silakan masuk kembali.',
  'resource-exhausted': 'Kuota layanan habis. Coba lagi nanti.',
};

export function getErrorMessage(error: unknown, fallback = 'Terjadi kesalahan. Silakan coba lagi.'): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof FirebaseConfigError) return error.message;
  if (error instanceof FirebaseError) {
    return AUTH_MESSAGES[error.code] ?? FIRESTORE_MESSAGES[error.code] ?? fallback;
  }
  return fallback;
}

/** Tolak promise bila tidak selesai dalam `ms` (mis. saat offline, tulis Firestore menggantung). */
export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new AppError('timeout', message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

