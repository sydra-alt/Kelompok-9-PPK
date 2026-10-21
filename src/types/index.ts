/**
 * Kontrak tipe data bersama (Sprint 1).
 * Semua layar praktikan & asisten mengimpor tipe dari sini agar tidak ada
 * definisi ganda. Ubah file ini hanya setelah koordinasi dengan PM.
 */

export type UserRole = 'student' | 'assistant';

export interface DummyUser {
  id: string;
  name: string;
  role: UserRole;
  /** NIM untuk praktikan, NIP/ID asisten untuk asisten. */
  identifier: string;
  /** Kelas praktikan. Untuk asisten boleh berisi daftar kelas yang diampu. */
  className: string;
}

export type SessionStatus = 'upcoming' | 'open' | 'closed';

export interface PracticeSession {
  id: string;
  practicalName: string;
  className: string;
  /** Format: YYYY-MM-DD */
  date: string;
  /** Format: HH:mm */
  startTime: string;
  /** Format: HH:mm */
  endTime: string;
  status: SessionStatus;
  /** Informasi tambahan opsional untuk detail sesi. */
  topic?: string;
  room?: string;
  assistantName?: string;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  /** Format waktu lokal: YYYY-MM-DDTHH:mm:ss */
  attendanceTime: string;
}
