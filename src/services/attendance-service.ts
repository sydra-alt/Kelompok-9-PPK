import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';

import { AppError, withTimeout } from '@/services/errors';
import { getDb } from '@/services/firebase';
import { getCurrentDeviceLocation } from '@/services/location-service';
import { attendanceId, COLLECTIONS, toLab, toPracticeSession } from '@/services/firestore-schema';
import type { PracticeSession, UserProfile } from '@/types';
import { distanceInMeters } from '@/utils/distance';

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
  const deviceLocation = await getCurrentDeviceLocation();
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

    if (!session.labId) {
      throw new AppError('session-lab-missing', 'Lokasi laboratorium belum ditautkan ke sesi ini. Hubungi asisten.');
    }

    const labSnap = await tx.get(doc(db, COLLECTIONS.labs, session.labId));
    const lab = toLab(labSnap);
    if (!lab) {
      throw new AppError('lab-location-invalid', 'Data lokasi laboratorium tidak tersedia atau tidak valid.');
    }

    const distanceMeters = distanceInMeters(deviceLocation, lab);
    if (distanceMeters > lab.radiusMeters) {
      throw new AppError(
        'outside-attendance-radius',
        `Kamu berada di luar radius presensi (${Math.round(distanceMeters)} m dari lab; batas ${lab.radiusMeters} m).`,
      );
    }

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
      latitude: deviceLocation.latitude,
      longitude: deviceLocation.longitude,
      distanceMeters: Math.round(distanceMeters),
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

