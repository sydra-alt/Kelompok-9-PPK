/** Response from `POST /api/attendance/submit`. */
export interface AttendanceSubmissionResult {
  attendanceId: string;
  attendanceStatus: 'on_time' | 'late';
  attendedAt: string;
  lateMinutes: number;
  distanceMeters: number;
  fineId?: string;
  fineAmount?: number;
}
