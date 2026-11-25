import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  type DocumentReference,
  type QuerySnapshot,
  type Unsubscribe,
} from 'firebase/firestore';

import { AppError, withTimeout } from '@/services/errors';
import { getDb } from '@/services/firebase';
import { COLLECTIONS, toLab } from '@/services/firestore-schema';
import type { Lab } from '@/types';

/**
 * Layanan pengelolaan data laboratorium.
 *
 * Menyediakan listener real-time dan CRUD koleksi `labs` di Firestore sebagai
 * acuan marker peta dan validasi radius presensi praktikan.
 */

export interface SnapshotMeta {
  fromCache: boolean;
}

export type OnData<T> = (data: T, meta: SnapshotMeta) => void;
export type OnError = (error: unknown) => void;

export interface LabInput {
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  building?: string;
  description?: string;
}

const WRITE_TIMEOUT_MS = 15000;
const MAX_LAB_NAME_LENGTH = 120;
const MAX_RADIUS_METERS = 10000;

/** Mengubah input angka koordinat/radius (menerima koma maupun titik desimal). */
export function parseCoordinateInput(raw: string): number {
  const normalized = raw.trim().replace(',', '.');
  if (!normalized) return Number.NaN;
  return Number(normalized);
}

/** Validasi data laboratorium sebelum disimpan ke Firestore. */
export function validateLabInput(input: LabInput): string | null {
  const name = input.name.trim();
  if (!name) return 'Nama laboratorium wajib diisi.';
  if (name.length > MAX_LAB_NAME_LENGTH) {
    return `Nama laboratorium maksimal ${MAX_LAB_NAME_LENGTH} karakter.`;
  }
  if (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90) {
    return 'Latitude harus berupa angka valid antara -90 sampai 90.';
  }
  if (!Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180) {
    return 'Longitude harus berupa angka valid antara -180 sampai 180.';
  }
  if (
    !Number.isFinite(input.radiusMeters) ||
    input.radiusMeters <= 0 ||
    input.radiusMeters > MAX_RADIUS_METERS
  ) {
    return `Radius presensi harus antara 1 sampai ${MAX_RADIUS_METERS} meter.`;
  }
  return null;
}

/** Seluruh laboratorium dari Firestore secara real-time, diurutkan berdasarkan nama. */
export function subscribeAllLabs(onData: OnData<Lab[]>, onError: OnError): Unsubscribe {
  return onSnapshot(
    collection(getDb(), COLLECTIONS.labs),
    { includeMetadataChanges: true },
    (snap: QuerySnapshot) =>
      onData(
        snap.docs
          .map(toLab)
          .filter((lab): lab is Lab => lab !== null)
          .sort((a, b) => a.name.localeCompare(b.name)),
        { fromCache: snap.metadata.fromCache },
      ),
    onError,
  );
}

export async function createLab(input: LabInput): Promise<string> {
  const error = validateLabInput(input);
  if (error) throw new AppError('invalid-input', error);

  const ref = await withTimeout<DocumentReference>(
    addDoc(collection(getDb(), COLLECTIONS.labs), {
      name: input.name.trim(),
      latitude: input.latitude,
      longitude: input.longitude,
      radiusMeters: Math.round(input.radiusMeters),
      building: input.building?.trim() || null,
      description: input.description?.trim() || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
    WRITE_TIMEOUT_MS,
    'Gagal menambahkan laboratorium: koneksi ke server terlalu lama.',
  );
  return ref.id;
}

export async function updateLab(labId: string, input: LabInput): Promise<void> {
  const error = validateLabInput(input);
  if (error) throw new AppError('invalid-input', error);

  await withTimeout(
    updateDoc(doc(getDb(), COLLECTIONS.labs, labId), {
      name: input.name.trim(),
      latitude: input.latitude,
      longitude: input.longitude,
      radiusMeters: Math.round(input.radiusMeters),
      building: input.building?.trim() || null,
      description: input.description?.trim() || null,
      updatedAt: serverTimestamp(),
    }),
    WRITE_TIMEOUT_MS,
    'Gagal memperbarui laboratorium: koneksi ke server terlalu lama.',
  );
}

export async function deleteLab(labId: string): Promise<void> {
  await withTimeout(
    deleteDoc(doc(getDb(), COLLECTIONS.labs, labId)),
    WRITE_TIMEOUT_MS,
    'Gagal menghapus laboratorium: koneksi ke server terlalu lama.',
  );
}
