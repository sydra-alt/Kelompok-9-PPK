import { doc, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';

import { classifyReason } from '@/services/ai-classifier';
import { AppError, withTimeout } from '@/services/errors';
import { getDb } from '@/services/firebase';
import { COLLECTIONS, permissionRequestId, toPracticeSession } from '@/services/firestore-schema';
import type { UserProfile } from '@/types';

/**
 * Pengajuan izin praktikan (PIC: Programmer 1).
 *
 * Alur:
 * 1. Validasi alasan di client (`validatePermissionReason`).
 * 2. Simpan `permissionRequests/{sessionId}_{uid}` via transaksi dengan
 *    `status: 'pending'` dan `aiClassification.status: 'pending'`.
 * 3. Panggil API AI di latar belakang lalu perbarui HANYA field
 *    `aiClassification`. Kegagalan API tidak membatalkan pengajuan.
 */

export const REASON_MIN_LENGTH = 10;
export const REASON_MAX_LENGTH = 500;
const TRANSACTION_TIMEOUT_MS = 15000;

export function validatePermissionReason(reason: string): string | null {
  const trimmed = reason.trim();
  if (!trimmed) return 'Alasan izin wajib diisi.';
  if (trimmed.length < REASON_MIN_LENGTH) return `Alasan minimal ${REASON_MIN_LENGTH} karakter agar jelas.`;
  if (trimmed.length > REASON_MAX_LENGTH) return `Alasan maksimal ${REASON_MAX_LENGTH} karakter.`;
  return null;
}

/** Simpan pengajuan izin lalu jalankan klasifikasi AI (tidak ditunggu). Mengembalikan ID pengajuan. */
export async function submitPermissionRequest(
  student: UserProfile,
  sessionId: string,
  reason: string,
): Promise<string> {
  const validation = validatePermissionReason(reason);
  if (validation) throw new AppError('invalid-reason', validation);

  const db = getDb();
  const requestId = permissionRequestId(sessionId, student.uid);
  const sessionRef = doc(db, COLLECTIONS.sessions, sessionId);
  const requestRef = doc(db, COLLECTIONS.permissionRequests, requestId);
  const trimmedReason = reason.trim();

  const transaction = runTransaction(db, async (tx) => {
    const sessionSnap = await tx.get(sessionRef);
    if (!sessionSnap.exists()) {
      throw new AppError('session-not-found', 'Sesi tidak ditemukan atau sudah dihapus.');
    }
    const session = toPracticeSession(sessionSnap);
    if (session.status === 'closed') {
      throw new AppError('session-closed', 'Sesi sudah ditutup. Pengajuan izin tidak dapat dikirim.');
    }
    const existing = await tx.get(requestRef);
    if (existing.exists()) {
      throw new AppError('already-requested', 'Kamu sudah mengajukan izin untuk sesi ini.');
    }

    tx.set(requestRef, {
      sessionId,
      classId: session.classId ?? '',
      studentId: student.uid,
      studentName: student.name,
      studentIdentifier: student.identifier,
      practicalName: session.practicalName,
      className: session.className,
      sessionDate: session.date,
      reason: trimmedReason,
      status: 'pending',
      aiClassification: { status: 'pending', category: null, confidence: null, error: null },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      decidedAt: null,
      decidedBy: null,
      decidedByName: null,
      decisionNote: null,
    });
  });

  await withTimeout(
    transaction,
    TRANSACTION_TIMEOUT_MS,
    'Pengajuan gagal dikirim karena koneksi ke server terlalu lama. Coba lagi.',
  );

  // Klasifikasi berjalan di latar belakang; pengajuan sudah tersimpan.
  void classifyPermissionRequest(requestId, trimmedReason);
  return requestId;
}

/**
 * Panggil API AI dan simpan hasilnya ke `aiClassification`. Aman dipanggil
 * ulang (tombol "Coba klasifikasi lagi"). Tidak pernah melempar error.
 */
export async function classifyPermissionRequest(requestId: string, reason: string): Promise<void> {
  const outcome = await classifyReason(reason);
  const aiClassification = outcome.ok
    ? { status: 'success', category: outcome.category, confidence: outcome.confidence, error: null }
    : { status: outcome.skipped ? 'skipped' : 'failed', category: null, confidence: null, error: outcome.error };

  try {
    await updateDoc(doc(getDb(), COLLECTIONS.permissionRequests, requestId), {
      aiClassification: { ...aiClassification, classifiedAt: serverTimestamp() },
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Gagal menyimpan hasil AI tidak memengaruhi pengajuan; status tetap `pending`
    // dan praktikan dapat mencoba klasifikasi ulang dari daftar pengajuan.
  }
}

