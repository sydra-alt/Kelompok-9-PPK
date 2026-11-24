import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';

import { AppError, withTimeout } from '@/services/errors';
import { getDb, getFirebaseAuth } from '@/services/firebase';
import { attendanceId, COLLECTIONS, toLab, toPracticeSession } from '@/services/firestore-schema';
import { getCurrentDeviceLocation } from '@/services/location-service';
import type { PracticeSession } from '@/types';
import { distanceInMeters } from '@/utils/distance';

/**
 * Presensi praktikan (PIC: Programmer 1).
 *
 * Mode Spark: lokasi diperoleh di perangkat dan diperiksa terhadap data lab
 * Firestore. Transaksi menggunakan ID deterministik agar presensi ganda ditolak.
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

export async function submitAttendance(sessionId: string): Promise<void> {
  const currentUser = getFirebaseAuth().currentUser;
  if (!currentUser) throw new AppError('unauthenticated', 'Sesi login berakhir. Silakan masuk kembali.');

  const deviceLocation = await getCurrentDeviceLocation();
  const db = getDb();
  const sessionRef = doc(db, COLLECTIONS.sessions, sessionId);
  const attendanceRef = doc(db, COLLECTIONS.attendance, attendanceId(sessionId, currentUser.uid));

  const transaction = runTransaction(db, async (tx) => {
    const sessionSnap = await tx.get(sessionRef);
    if (!sessionSnap.exists()) {
      throw new AppError('session-not-found', 'Sesi tidak ditemukan atau sudah dihapus.');
    }

    const session = toPracticeSession(sessionSnap);
    const blockReason = getAttendanceBlockReason(session);
    if (blockReason) throw new AppError(`session-${session.status}`, blockReason);
    if (!session.classId) {
      throw new AppError('session-class-missing', 'Sesi belum terhubung ke kelas. Hubungi asisten.');
    }
    if (!session.labId) {
      throw new AppError('session-lab-missing', 'Lokasi laboratorium belum ditautkan ke sesi ini. Hubungi asisten.');
    }

    const membershipRef = doc(db, COLLECTIONS.classMembers, `${session.classId}_${currentUser.uid}`);
    const labRef = doc(db, COLLECTIONS.labs, session.labId);
    const userRef = doc(db, COLLECTIONS.users, currentUser.uid);
    const [membershipSnap, labSnap, userSnap, attendanceSnap] = await Promise.all([
      tx.get(membershipRef),
      tx.get(labRef),
      tx.get(userRef),
      tx.get(attendanceRef),
    ]);

    if (!userSnap.exists() || userSnap.data().role !== 'praktikan') {
      throw new AppError('invalid-student-profile', 'Profil akun praktikan tidak valid. Hubungi asisten.');
    }
    if (
      !membershipSnap.exists() ||
      membershipSnap.data().classId !== session.classId ||
      membershipSnap.data().studentId !== currentUser.uid
    ) {
      throw new AppError('not-class-member', 'Akun kamu belum terdaftar pada kelas sesi ini.');
    }
    if (attendanceSnap.exists()) {
      throw new AppError('already-attended', 'Kamu sudah presensi pada sesi ini. Presensi ganda tidak diizinkan.');
    }

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

    const profile = userSnap.data();
    tx.set(attendanceRef, {
      sessionId,
      classId: session.classId,
      studentId: currentUser.uid,
      studentName: typeof profile.name === 'string' ? profile.name : '',
      studentIdentifier: typeof profile.identifier === 'string' ? profile.identifier : '',
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

