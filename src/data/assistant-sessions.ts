import type { AttendanceRecord, PracticeSession } from '@/types';
import { schedules } from '@/data/schedules';

/**
 * Asisten menyimpan salinan state jadwal terpisah dari alur praktikan.
 * ID dan bentuk sesi tetap memakai kontrak data bersama.
 */
export const initialAssistantSessions: PracticeSession[] = schedules.map((session) => ({ ...session }));

/** Rekap dummy untuk layar asisten; tidak disinkronkan dengan presensi praktikan. */
export const initialAssistantAttendance: AttendanceRecord[] = [
  {
    id: 'assistant-att-001',
    sessionId: 'ses-002',
    studentId: 's-001',
    studentName: 'Ahmad Fauzan',
    attendanceTime: '2026-10-21T08:02:00',
  },
  {
    id: 'assistant-att-002',
    sessionId: 'ses-002',
    studentId: 's-002',
    studentName: 'Siti Rahmawati',
    attendanceTime: '2026-10-21T08:05:00',
  },
  {
    id: 'assistant-att-003',
    sessionId: 'ses-006',
    studentId: 's-003',
    studentName: 'Budi Santoso',
    attendanceTime: '2026-10-21T10:01:00',
  },
  {
    id: 'assistant-att-004',
    sessionId: 'ses-001',
    studentId: 's-001',
    studentName: 'Ahmad Fauzan',
    attendanceTime: '2026-10-14T08:03:00',
  },
];
