import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc, type Unsubscribe } from 'firebase/firestore';

import { AppError, withTimeout } from '@/services/errors';
import { getDb, getFirebaseAuth } from '@/services/firebase';
import { COLLECTIONS, toUserProfile } from '@/services/firestore-schema';
import type { UserProfile } from '@/types';

/**
 * Service autentikasi & profil pengguna (PIC: Programmer 1).
 *
 * Sumber peran tepercaya: field `role` di `users/{uid}`.
 * - Registrasi dari aplikasi SELALU membuat profil `praktikan`.
 * - Akun `asisten` ditetapkan oleh pengajar/admin dengan mengubah `role`
 *   langsung di Firebase Console. Security Rules (Programmer 2) melarang
 *   pengguna mengubah `role` miliknya sendiri.
 */

export interface RegisterInput {
  name: string;
  identifier: string;
  email: string;
  password: string;
}

export interface ValidationErrors {
  [field: string]: string | undefined;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NIM_PATTERN = /^[0-9A-Za-z.-]{5,20}$/;
const WRITE_TIMEOUT_MS = 15000;

export function validateLogin(email: string, password: string): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!email.trim()) errors.email = 'Email wajib diisi.';
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = 'Format email tidak valid.';
  if (!password) errors.password = 'Kata sandi wajib diisi.';
  return errors;
}

export function validateRegister(input: RegisterInput & { confirmPassword: string }): ValidationErrors {
  const errors: ValidationErrors = validateLogin(input.email, input.password);
  const name = input.name.trim();
  if (!name) errors.name = 'Nama lengkap wajib diisi.';
  else if (name.length < 3) errors.name = 'Nama minimal 3 karakter.';
  if (!input.identifier.trim()) errors.identifier = 'NIM wajib diisi.';
  else if (!NIM_PATTERN.test(input.identifier.trim()))
    errors.identifier = 'NIM hanya boleh berisi angka/huruf, 5–20 karakter.';
  if (input.password && input.password.length < 6) errors.password = 'Kata sandi minimal 6 karakter.';
  if (input.confirmPassword !== input.password) errors.confirmPassword = 'Konfirmasi kata sandi tidak sama.';
  return errors;
}

export function validateProfileCompletion(name: string, identifier: string): ValidationErrors {
  const errors: ValidationErrors = {};
  const trimmedName = name.trim();
  if (!trimmedName) errors.name = 'Nama lengkap wajib diisi.';
  else if (trimmedName.length < 3) errors.name = 'Nama minimal 3 karakter.';
  if (!identifier.trim()) errors.identifier = 'NIM wajib diisi.';
  else if (!NIM_PATTERN.test(identifier.trim()))
    errors.identifier = 'NIM hanya boleh berisi angka/huruf, 5–20 karakter.';
  return errors;
}

export const hasErrors = (errors: ValidationErrors) => Object.values(errors).some(Boolean);

/** Pantau perubahan status login (termasuk pemulihan sesi saat aplikasi dibuka). */
export function subscribeAuthState(callback: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(getFirebaseAuth(), callback);
}

export async function signIn(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
}

/**
 * Registrasi praktikan: buat akun Auth lalu profil `users/{uid}`.
 * Jika pembuatan profil gagal, akun Auth dihapus agar tidak ada akun "yatim"
 * tanpa profil/peran.
 */
export async function registerStudent(input: RegisterInput): Promise<void> {
  const auth = getFirebaseAuth();
  const credential = await createUserWithEmailAndPassword(auth, input.email.trim(), input.password);
  const { user } = credential;

  try {
    await updateProfile(user, { displayName: input.name.trim() }).catch(() => undefined);
    await withTimeout(
      setDoc(doc(getDb(), COLLECTIONS.users, user.uid), {
        uid: user.uid,
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        identifier: input.identifier.trim(),
        role: 'praktikan',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
      WRITE_TIMEOUT_MS,
      'Gagal menyimpan profil: koneksi ke server terlalu lama.',
    );
  } catch (error) {
    await deleteUser(user).catch(() => firebaseSignOut(auth));
    throw error instanceof AppError
      ? error
      : new AppError('profile-create-failed', 'Akun gagal dibuat karena profil tidak dapat disimpan. Coba lagi.');
  }
}

/**
 * Lengkapi profil `users/{uid}` bagi akun Auth yang belum memiliki dokumen profil.
 * Peran tetap dikunci `praktikan` (peran `asisten` hanya dapat ditetapkan di server/Console).
 */
export async function completeStudentProfile(input: { name: string; identifier: string }): Promise<void> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new AppError('unauthenticated', 'Sesi login tidak ditemukan. Silakan masuk kembali.');

  await updateProfile(user, { displayName: input.name.trim() }).catch(() => undefined);
  await withTimeout(
    setDoc(doc(getDb(), COLLECTIONS.users, user.uid), {
      uid: user.uid,
      name: input.name.trim(),
      email: (user.email ?? '').toLowerCase(),
      identifier: input.identifier.trim(),
      role: 'praktikan',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
    WRITE_TIMEOUT_MS,
    'Gagal menyimpan profil: koneksi ke server terlalu lama.',
  );
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(getFirebaseAuth());
}

export async function requestPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
}

/** Listener real-time profil `users/{uid}`; `null` bila dokumen tidak ada/tidak valid. */
export function subscribeUserProfile(
  uid: string,
  onData: (profile: UserProfile | null) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    doc(getDb(), COLLECTIONS.users, uid),
    (snap) => onData(toUserProfile(snap)),
    onError,
  );
}

