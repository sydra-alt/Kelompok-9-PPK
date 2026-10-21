import type { DummyUser, UserRole } from '@/types';

/**
 * Identitas dummy untuk simulasi. ID bersifat stabil — jangan diubah
 * karena dirujuk oleh data presensi.
 *
 * Catatan: `s-004` sengaja berada di kelas tanpa jadwal untuk menguji empty state.
 */
export const users: DummyUser[] = [
  { id: 's-001', name: 'Ahmad Fauzan', role: 'student', identifier: '2211102001', className: 'TI-3A' },
  { id: 's-002', name: 'Siti Rahmawati', role: 'student', identifier: '2211102002', className: 'TI-3A' },
  { id: 's-003', name: 'Budi Santoso', role: 'student', identifier: '2211102031', className: 'TI-3B' },
  { id: 's-004', name: 'Dewi Lestari', role: 'student', identifier: '2211102055', className: 'TI-3C' },
  { id: 'a-001', name: 'Rizky Pratama', role: 'assistant', identifier: 'AST-01', className: 'TI-3A, TI-3B' },
  { id: 'a-002', name: 'Nadia Putri', role: 'assistant', identifier: 'AST-02', className: 'TI-3B' },
];

export function getUsersByRole(role: UserRole): DummyUser[] {
  return users.filter((user) => user.role === role);
}

export function getUserById(id: string | undefined): DummyUser | undefined {
  if (!id) return undefined;
  return users.find((user) => user.id === id);
}
