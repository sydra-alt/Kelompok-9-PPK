import { useMemo, useSyncExternalStore } from 'react';

import { initialStudentAttendance } from '@/data/studentAttendance';
import type { AttendanceRecord, DummyUser, PracticeSession } from '@/types';
import { formatClock, nowLocalDateTime } from '@/utils/format';

/**
 * State presensi lokal untuk alur praktikan.
 *
 * Store kecil di memori (hilang saat aplikasi ditutup) supaya layar detail
 * sesi dan riwayat praktikan membaca data yang sama — tanpa backend,
 * tanpa library global state.
 */

let records: AttendanceRecord[] = [...initialStudentAttendance];
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return records;
}

function emit() {
  listeners.forEach((listener) => listener());
}

export type AttendanceResult =
  | { ok: true; record: AttendanceRecord }
  | { ok: false; reason: string };

/** Alasan presensi tidak tersedia berdasarkan status sesi, atau `null` jika tersedia. */
export function getAttendanceBlockReason(session: PracticeSession): string | null {
  if (session.status === 'upcoming') {
    return 'Sesi belum dibuka oleh asisten. Presensi akan tersedia setelah sesi dibuka.';
  }
  if (session.status === 'closed') {
    return 'Sesi sudah ditutup. Presensi tidak dapat dilakukan lagi.';
  }
  return null;
}

export function findAttendance(studentId: string, sessionId: string): AttendanceRecord | undefined {
  return records.find((r) => r.studentId === studentId && r.sessionId === sessionId);
}

/**
 * Mencatat presensi dengan validasi:
 * 1. Sesi harus berstatus `open`.
 * 2. Praktikan yang sama tidak boleh presensi dua kali pada sesi yang sama.
 */
export function submitAttendance(student: DummyUser, session: PracticeSession): AttendanceResult {
  const blockReason = getAttendanceBlockReason(session);
  if (blockReason) {
    return { ok: false, reason: blockReason };
  }

  const existing = findAttendance(student.id, session.id);
  if (existing) {
    return {
      ok: false,
      reason: `Kamu sudah presensi pada sesi ini pukul ${formatClock(existing.attendanceTime)} WIB. Presensi ganda tidak diizinkan.`,
    };
  }

  const record: AttendanceRecord = {
    id: `att-${session.id}-${student.id}-${Date.now()}`,
    sessionId: session.id,
    studentId: student.id,
    studentName: student.name,
    attendanceTime: nowLocalDateTime(),
  };

  records = [...records, record];
  emit();
  return { ok: true, record };
}

/** Daftar presensi milik satu praktikan; otomatis re-render saat ada presensi baru. */
export function useStudentAttendance(studentId: string | undefined): AttendanceRecord[] {
  const all = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return useMemo(() => all.filter((r) => r.studentId === studentId), [all, studentId]);
}
