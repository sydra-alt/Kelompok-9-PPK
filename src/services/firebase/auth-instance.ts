import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FirebaseApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth, type Auth } from 'firebase/auth';

/**
 * Auth untuk Android/iOS: sesi disimpan di AsyncStorage agar pengguna tetap
 * login saat aplikasi dibuka kembali (pemulihan state sesi).
 */
export function createAuth(app: FirebaseApp): Auth {
  try {
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    // Fast Refresh dapat memanggil ulang modul; initializeAuth hanya boleh sekali.
    return getAuth(app);
  }
}

