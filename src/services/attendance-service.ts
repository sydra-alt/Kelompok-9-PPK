import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';

import { AppError, withTimeout } from '@/services/errors';
import { getDb } from '@/services/firebase';
import { attendanceId, COLLECTIONS, toPracticeSession } from '@/services/firestore-schema';
import type { PracticeSession, UserProfile } from '@/types';

/**
 * Presensi praktikan (PIC: Programmer 1).
 *
 * Anti presensi ganda dijamin dengan dua lapis:
 * 1. ID dokumen deterministik `attendance/{sessionId}_{uid}`.
 * 2. Transaksi Firestore yang membaca status sesi TERBARU dari server dan
 *    memastikan dokumen presensi belum ada sebelum menulis.
 * Security Rules (Programmer 2) sebaiknya hanya mengizinkan `create` (tanpa
 * `update`) sehingga tulis ulang ditolak di server.
 */

const TRANSACTION_TIMEOUT_MS = 15000;

/** Alasan presensi tidak tersedia berdasarkan status sesi, atau `null` jika tersedia. */
export function getAttendanceBlockReason(session: PracticeSession): string | null {
  if (session.status === 'scheduled') {
    return 'Sesi belum dibuka oleh asisten. Presensi akan tersedia setelah sesi dibuka.';
  }
  if (session.status === 'closed') {
    return 'Sesi sudah ditutup. Presensi tidak dapat dilakukan lagi.';
  }
  return null;
}

export async function submitAttendance(student: UserProfile, sessionId: string): Promise<void> {
  const db = getDb();
  const sessionRef = doc(db, COLLECTIONS.sessions, sessionId);
  const attendanceRef = doc(db, COLLECTIONS.attendance, attendanceId(sessionId, student.uid));

  const transaction = runTransaction(db, async (tx) => {
    const sessionSnap = await tx.get(sessionRef);
    if (!sessionSnap.exists()) {
      throw new AppError('session-not-found', 'Sesi tidak ditemukan atau sudah dihapus.');
    }
    const session = toPracticeSession(sessionSnap);
    const blockReason = getAttendanceBlockReason(session);
    if (blockReason) throw new AppError(`session-${session.status}`, blockReason);

    const existing = await tx.get(attendanceRef);
    if (existing.exists()) {
      throw new AppError('already-attended', 'Kamu sudah presensi pada sesi ini. Presensi ganda tidak diizinkan.');
    }

    tx.set(attendanceRef, {
      sessionId,
      classId: session.classId ?? '',
      studentId: student.uid,
      studentName: student.name,
      studentIdentifier: student.identifier,
      attendedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
  });

  await withTimeout(
    transaction,
    TRANSACTION_TIMEOUT_MS,
    'Presensi gagal karena koneksi ke server terlalu lama. Periksa internet lalu coba lagi.',
  );
}

