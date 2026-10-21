import type { AttendanceRecord } from '@/types';

/**
 * Data awal presensi milik alur praktikan.
 * Terpisah dari `assistantAttendance.ts` — tidak wajib sinkron (lihat SRS §2).
 */
export const initialStudentAttendance: AttendanceRecord[] = [
  {
    id: 'att-s-001',
    sessionId: 'ses-001',
    studentId: 's-001',
    studentName: 'Ahmad Fauzan',
    attendanceTime: '2026-10-14T08:07:12',
  },
  {
    id: 'att-s-002',
    sessionId: 'ses-005',
    studentId: 's-003',
    studentName: 'Budi Santoso',
    attendanceTime: '2026-10-15T10:03:45',
  },
];
