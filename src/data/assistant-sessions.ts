export type SessionStatus = 'upcoming' | 'open' | 'closed';

export type AssistantSession = {
  id: string;
  practicalName: string;
  className: string;
  date: string;
  startTime: string;
  endTime: string;
  room: string;
  status: SessionStatus;
};

export type AssistantAttendance = {
  id: string;
  sessionId: string;
  studentName: string;
  studentId: string;
  time: string;
};

export const initialSessions: AssistantSession[] = [
  {
    id: 'session-1',
    practicalName: 'Pemrograman Mobile',
    className: 'TI-4A',
    date: 'Rabu, 21 Oktober 2026',
    startTime: '09.00',
    endTime: '11.00',
    room: 'Lab Komputer 2',
    status: 'open',
  },
  {
    id: 'session-2',
    practicalName: 'Basis Data',
    className: 'TI-4B',
    date: 'Rabu, 21 Oktober 2026',
    startTime: '13.00',
    endTime: '15.00',
    room: 'Lab Komputer 1',
    status: 'upcoming',
  },
  {
    id: 'session-3',
    practicalName: 'Rekayasa Perangkat Lunak',
    className: 'TI-4A',
    date: 'Jumat, 23 Oktober 2026',
    startTime: '10.00',
    endTime: '12.00',
    room: 'Lab Komputer 3',
    status: 'closed',
  },
];

export const initialAttendance: AssistantAttendance[] = [
  { id: 'att-1', sessionId: 'session-1', studentId: 'mhs-01', studentName: 'Alya Putri', time: '09.02' },
  { id: 'att-2', sessionId: 'session-1', studentId: 'mhs-02', studentName: 'Bima Pratama', time: '09.04' },
  { id: 'att-3', sessionId: 'session-1', studentId: 'mhs-03', studentName: 'Citra Lestari', time: '09.07' },
  { id: 'att-4', sessionId: 'session-3', studentId: 'mhs-04', studentName: 'Daffa Ramadhan', time: '10.01' },
];
