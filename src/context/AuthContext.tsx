import type { User } from 'firebase/auth';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { signOut, subscribeAuthState, subscribeUserProfile } from '@/services/auth-service';
import { getErrorMessage } from '@/services/errors';
import { isFirebaseConfigured, missingFirebaseEnv } from '@/services/firebase/config';
import type { UserProfile } from '@/types';

/**
 * State autentikasi & profil pengguna aplikasi (PIC: Programmer 1).
 *
 * Siklus status:
 * - `config-missing`  : variabel env Firebase belum lengkap.
 * - `initializing`    : memulihkan sesi Firebase Auth / memuat profil `users/{uid}`.
 * - `unauthenticated` : belum login.
 * - `profile-missing` : akun Auth ada tetapi dokumen `users/{uid}` belum ditemukan.
 * - `authenticated`   : akun Auth + profil `users/{uid}` siap (`profile` non-null).
 * - `error`           : gagal memuat profil dari Firestore (mis. offline saat pertama kali).
 */
export type AuthStatus =
  | 'config-missing'
  | 'initializing'
  | 'unauthenticated'
  | 'profile-missing'
  | 'authenticated'
  | 'error';

interface ProfileSnapshot {
  key: string;
  profile: UserProfile | null;
  errorMessage: string | null;
}

interface AuthContextValue {
  status: AuthStatus;
  firebaseUser: User | null;
  profile: UserProfile | null;
  errorMessage: string | null;
  missingEnv: string[];
  retryProfile: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!isFirebaseConfigured);
  const [retryKey, setRetryKey] = useState(0);
  const [profileSnapshot, setProfileSnapshot] = useState<ProfileSnapshot | null>(null);

  const expectedKey = authUser ? `${authUser.uid}:${retryKey}` : null;

  // 1. Pantau status login Firebase Auth (termasuk pemulihan sesi saat app dibuka ulang).
  useEffect(() => {
    if (!isFirebaseConfigured) return undefined;

    const unsubscribe = subscribeAuthState((user) => {
      setAuthUser(user);
      setAuthReady(true);
    });
    return unsubscribe;
  }, []);

  // 2. Pantau dokumen profil `users/{uid}` secara real-time saat user sudah login.
  useEffect(() => {
    if (!isFirebaseConfigured || !authUser || !expectedKey) return undefined;

    const unsubscribe = subscribeUserProfile(
      authUser.uid,
      (nextProfile) => {
        setProfileSnapshot({
          key: expectedKey,
          profile: nextProfile,
          errorMessage: null,
        });
      },
      (error) => {
        setProfileSnapshot({
          key: expectedKey,
          profile: null,
          errorMessage: getErrorMessage(error, 'Gagal memuat profil pengguna dari server.'),
        });
      },
    );

    return unsubscribe;
  }, [authUser, expectedKey]);

  const retryProfile = useCallback(() => {
    setRetryKey((prev) => prev + 1);
  }, []);

  const logout = useCallback(async () => {
    if (!isFirebaseConfigured) return;
    await signOut();
  }, []);

  const isProfileLoaded = Boolean(expectedKey && profileSnapshot?.key === expectedKey);
  const profile = isProfileLoaded ? (profileSnapshot?.profile ?? null) : null;
  const errorMessage = isProfileLoaded ? (profileSnapshot?.errorMessage ?? null) : null;

  const status: AuthStatus = useMemo(() => {
    if (!isFirebaseConfigured) return 'config-missing';
    if (!authReady) return 'initializing';
    if (!authUser) return 'unauthenticated';
    if (!isProfileLoaded) return 'initializing';
    if (errorMessage) return 'error';
    if (!profile) return 'profile-missing';
    return 'authenticated';
  }, [authReady, authUser, isProfileLoaded, errorMessage, profile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      firebaseUser: authUser,
      profile,
      errorMessage,
      missingEnv: missingFirebaseEnv,
      retryProfile,
      logout,
    }),
    [status, authUser, profile, errorMessage, retryProfile, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth harus digunakan di dalam AuthProvider.');
  }
  return ctx;
}
