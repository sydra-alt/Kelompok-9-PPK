import type { FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

/**
 * Auth untuk web: `getAuth` secara default menyimpan sesi di IndexedDB /
 * localStorage browser sehingga sesi tetap pulih saat halaman dimuat ulang.
 */
export function createAuth(app: FirebaseApp): Auth {
  return getAuth(app);
}
