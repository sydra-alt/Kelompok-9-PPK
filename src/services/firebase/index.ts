import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

import { createAuth } from './auth-instance';
import { firebaseOptions, isFirebaseConfigured, missingFirebaseEnv } from './config';

/**
 * Inisialisasi Firebase secara lazy. Layar TIDAK boleh mengimpor file ini
 * secara langsung — gunakan fungsi di `src/services/*`.
 */

interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

let services: FirebaseServices | null = null;

export class FirebaseConfigError extends Error {
  constructor() {
    super(`Konfigurasi Firebase belum lengkap: ${missingFirebaseEnv.join(', ')}`);
    this.name = 'FirebaseConfigError';
  }
}

function getServices(): FirebaseServices {
  if (services) return services;
  if (!isFirebaseConfigured) throw new FirebaseConfigError();

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseOptions);
  services = { app, auth: createAuth(app), db: getFirestore(app) };
  return services;
}

export function getFirebaseAuth(): Auth {
  return getServices().auth;
}

export function getDb(): Firestore {
  return getServices().db;
}

