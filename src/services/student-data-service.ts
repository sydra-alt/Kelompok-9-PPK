import {
  collection,
  doc,
  documentId,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import { getDb } from '@/services/firebase';
import {
  COLLECTIONS,
  toAttendanceRecord,
  toClassMembership,
  toPermissionRequest,
  toPracticeClass,
  toPracticeSession,
} from '@/services/firestore-schema';
import type {
  AttendanceRecord,
  ClassMembership,
  PermissionRequest,
  PracticeClass,
  PracticeSession,
} from '@/types';

/**
 * Pembacaan data milik praktikan (PIC: Programmer 1). Semua fungsi memakai
 * listener real-time `onSnapshot` dan mengembalikan fungsi unsubscribe.
 *
 * Semua query difilter berdasarkan uid / keanggotaan kelas praktikan sehingga
 * cocok dengan Security Rules (query yang lebih luas akan ditolak server).
 * Pengurutan dilakukan di client agar tidak membutuhkan composite index.
 */

export interface SnapshotMeta {
  /** true bila data berasal dari cache lokal (mis. sedang offline). */
  fromCache: boolean;
}

export type OnData<T> = (data: T, meta: SnapshotMeta) => void;
export type OnError = (error: unknown) => void;

/** Batas operator `in` Firestore. */
const MAX_IN_VALUES = 30;

const bySchedule = (a: PracticeSession, b: PracticeSession) =>
  `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`);

/** Keanggotaan kelas praktikan: `classMembers` where studentId == uid. */
export function subscribeStudentMemberships(
  studentId: string,
  onData: OnData<ClassMembership[]>,
  onError: OnError,
): Unsubscribe {
  const q = query(collection(getDb(), COLLECTIONS.classMembers), where('studentId', '==', studentId));
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snap) =>
      onData(
        snap.docs.map(toClassMembership).filter((m) => m.classId),
        { fromCache: snap.metadata.fromCache },
      ),
    onError,
  );
}

/** Daftar kelas (`classes`) berdasarkan ID kelas yang diikuti praktikan. */
export function subscribeClassesByIds(
  classIds: string[],
  onData: OnData<PracticeClass[]>,
  onError: OnError,
): Unsubscribe {
  const ids = [...new Set(classIds)].slice(0, MAX_IN_VALUES);
  if (ids.length === 0) {
    onData([], { fromCache: false });
    return () => undefined;
  }
  const q = query(collection(getDb(), COLLECTIONS.classes), where(documentId(), 'in', ids));
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snap) =>
      onData(
        snap.docs.map(toPracticeClass).sort((a, b) => a.name.localeCompare(b.name)),
        { fromCache: snap.metadata.fromCache },
      ),
    onError,
  );
}

/** Daftar peserta (`classMembers`) pada kelas-kelas yang diikuti praktikan. */
export function subscribeClassParticipants(
  classIds: string[],
  onData: OnData<ClassMembership[]>,
  onError: OnError,
): Unsubscribe {
  const ids = [...new Set(classIds)].slice(0, MAX_IN_VALUES);
  if (ids.length === 0) {
    onData([], { fromCache: false });
    return () => undefined;
  }
  const q = query(collection(getDb(), COLLECTIONS.classMembers), where('classId', 'in', ids));
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snap) =>
      onData(
        snap.docs.map(toClassMembership).sort((a, b) => a.studentName.localeCompare(b.studentName)),
        { fromCache: snap.metadata.fromCache },
      ),
    onError,
  );
}

/** Sesi dari kelas-kelas yang diikuti praktikan, terurut berdasarkan jadwal. */
export function subscribeSessionsForClasses(
  classIds: string[],
  onData: OnData<PracticeSession[]>,
  onError: OnError,
): Unsubscribe {
  const ids = [...new Set(classIds)].slice(0, MAX_IN_VALUES);
  if (ids.length === 0) {
    onData([], { fromCache: false });
    return () => undefined;
  }
  const q = query(collection(getDb(), COLLECTIONS.sessions), where('classId', 'in', ids));
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snap) => onData(snap.docs.map(toPracticeSession).sort(bySchedule), { fromCache: snap.metadata.fromCache }),
    onError,
  );
}

/** Satu sesi (real-time) — dipakai layar detail untuk perubahan status buka/tutup. */
export function subscribeSession(
  sessionId: string,
  onData: OnData<PracticeSession | null>,
  onError: OnError,
): Unsubscribe {
  return onSnapshot(
    doc(getDb(), COLLECTIONS.sessions, sessionId),
    { includeMetadataChanges: true },
    (snap) => onData(snap.exists() ? toPracticeSession(snap) : null, { fromCache: snap.metadata.fromCache }),
    onError,
  );
}

/** Seluruh presensi milik praktikan. */
export function subscribeStudentAttendance(
  studentId: string,
  onData: OnData<AttendanceRecord[]>,
  onError: OnError,
): Unsubscribe {
  const q = query(collection(getDb(), COLLECTIONS.attendance), where('studentId', '==', studentId));
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snap) =>
      onData(
        snap.docs.map(toAttendanceRecord).sort((a, b) => b.attendanceTime.localeCompare(a.attendanceTime)),
        { fromCache: snap.metadata.fromCache },
      ),
    onError,
  );
}

/** Seluruh pengajuan izin milik praktikan, terbaru di atas. */
export function subscribeStudentPermissionRequests(
  studentId: string,
  onData: OnData<PermissionRequest[]>,
  onError: OnError,
): Unsubscribe {
  const q = query(collection(getDb(), COLLECTIONS.permissionRequests), where('studentId', '==', studentId));
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snap) =>
      onData(
        snap.docs
          .map(toPermissionRequest)
          .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
        { fromCache: snap.metadata.fromCache },
      ),
    onError,
  );
}

