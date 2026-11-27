import { doc, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';

import { classifyReason } from '@/services/ai-classifier';
import { AppError, withTimeout } from '@/services/errors';
import { getDb } from '@/services/firebase';
import { COLLECTIONS, permissionRequestId, toPracticeSession } from '@/services/firestore-schema';
import type { UserProfile } from '@/types';

/**
 * Layanan pengajuan izin praktikan.
 *
 * Alur:
 * 1. Validasi alasan di client (`validatePermissionReason`).
 * 2. Jalankan model sentimen EDOM lokal pada alasan.
 * 3. Simpan pengajuan dan hasil analisis pada transaksi yang sama. Jika model
 *    tidak mengenali teks, pengajuan tetap tersimpan dengan status analisis gagal.
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

/** Analisis alasan secara lokal lalu simpan pengajuan dan hasilnya bersama-sama. */
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
  const outcome = classifyReason(trimmedReason);
  const aiClassification = outcome.ok
    ? { status: 'success', sentiment: outcome.sentiment, confidence: null, error: null }
    : { status: 'failed', sentiment: null, confidence: null, error: outcome.error };

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
      aiClassification: { ...aiClassification, classifiedAt: serverTimestamp() },
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

  return requestId;
}

/**
 * Jalankan model lokal dan simpan hasilnya ke `aiClassification`. Aman dipanggil
 * ulang (tombol "Coba analisis ulang"). Error penyimpanan diteruskan ke layar.
 */
export async function classifyPermissionRequest(requestId: string, reason: string): Promise<void> {
  const outcome = await classifyReason(reason);
  const aiClassification = outcome.ok
    ? { status: 'success', sentiment: outcome.sentiment, confidence: null, error: null }
    : { status: 'failed', sentiment: null, confidence: null, error: outcome.error };

  await updateDoc(doc(getDb(), COLLECTIONS.permissionRequests, requestId), {
    aiClassification: { ...aiClassification, classifiedAt: serverTimestamp() },
    updatedAt: serverTimestamp(),
  });
}
