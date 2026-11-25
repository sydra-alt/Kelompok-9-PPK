import { AppError } from '@/services/errors';
import { submitAttendanceToBackend } from '@/services/sprint4-api-service';
import type { PracticeSession } from '@/types';
import type { AttendanceSubmissionResult } from '@/types/sprint4';

/**
 * Praktikan attendance client (Sprint 4).
 * The client requests attendance; the trusted backend validates location/time,
 * writes the attendance record, and creates a fine when the student is late.
 */

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

export async function submitAttendance(sessionId: string): Promise<AttendanceSubmissionResult> {
  if (!sessionId.trim()) {
    throw new AppError('session-id-missing', 'ID sesi tidak valid. Kembali ke jadwal lalu coba lagi.');
  }
  return submitAttendanceToBackend(sessionId);
}
