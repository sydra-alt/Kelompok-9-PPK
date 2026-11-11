import { useStudentData } from '@/context/StudentDataContext';
import type { AttendanceRecord } from '@/types';

export { getAttendanceBlockReason, submitAttendance } from '@/services/attendance-service';

/**
 * Daftar presensi milik praktikan yang sedang login (real-time dari Firestore).
 */
export function useStudentAttendance(): AttendanceRecord[] {
  const { attendance } = useStudentData();
  return attendance;
}
