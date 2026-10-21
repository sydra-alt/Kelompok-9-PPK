import type { PracticeSession } from '@/types';

/**
 * Jadwal sesi praktikum dummy. Status statis untuk sisi praktikan
 * (perubahan status oleh asisten tidak wajib tersinkron pada Sprint 1).
 */
export const schedules: PracticeSession[] = [
  {
    id: 'ses-001',
    practicalName: 'Pemrograman Mobile',
    className: 'TI-3A',
    date: '2026-10-14',
    startTime: '08:00',
    endTime: '10:00',
    status: 'closed',
    topic: 'Pengenalan React Native & Expo',
    room: 'Lab Komputer 1',
    assistantName: 'Rizky Pratama',
  },
  {
    id: 'ses-002',
    practicalName: 'Pemrograman Mobile',
    className: 'TI-3A',
    date: '2026-10-21',
    startTime: '08:00',
    endTime: '12:00',
    status: 'open',
    topic: 'Layout dengan Flexbox',
    room: 'Lab Komputer 1',
    assistantName: 'Rizky Pratama',
  },
  {
    id: 'ses-003',
    practicalName: 'Basis Data',
    className: 'TI-3A',
    date: '2026-10-21',
    startTime: '13:00',
    endTime: '15:00',
    status: 'upcoming',
    topic: 'Normalisasi Tabel',
    room: 'Lab Komputer 2',
    assistantName: 'Nadia Putri',
  },
  {
    id: 'ses-004',
    practicalName: 'Pemrograman Mobile',
    className: 'TI-3A',
    date: '2026-10-28',
    startTime: '08:00',
    endTime: '10:00',
    status: 'upcoming',
    topic: 'Navigasi Antarlayar',
    room: 'Lab Komputer 1',
    assistantName: 'Rizky Pratama',
  },
  {
    id: 'ses-005',
    practicalName: 'Jaringan Komputer',
    className: 'TI-3B',
    date: '2026-10-15',
    startTime: '10:00',
    endTime: '12:00',
    status: 'closed',
    topic: 'Subnetting IPv4',
    room: 'Lab Jaringan',
    assistantName: 'Nadia Putri',
  },
  {
    id: 'ses-006',
    practicalName: 'Pemrograman Mobile',
    className: 'TI-3B',
    date: '2026-10-21',
    startTime: '10:00',
    endTime: '12:00',
    status: 'open',
    topic: 'Layout dengan Flexbox',
    room: 'Lab Komputer 3',
    assistantName: 'Rizky Pratama',
  },
  {
    id: 'ses-007',
    practicalName: 'Basis Data',
    className: 'TI-3B',
    date: '2026-10-22',
    startTime: '13:00',
    endTime: '15:00',
    status: 'upcoming',
    topic: 'Normalisasi Tabel',
    room: 'Lab Komputer 2',
    assistantName: 'Nadia Putri',
  },
];

export function getSessionsByClass(className: string): PracticeSession[] {
  return schedules
    .filter((session) => session.className === className)
    .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
}

export function getSessionById(id: string | undefined): PracticeSession | undefined {
  if (!id) return undefined;
  return schedules.find((session) => session.id === id);
}
