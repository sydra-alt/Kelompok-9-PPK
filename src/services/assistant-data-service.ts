import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentReference,
  type DocumentSnapshot,
  type QuerySnapshot,
  type Unsubscribe,
} from 'firebase/firestore';

import { AppError, withTimeout } from '@/services/errors';
import { getDb } from '@/services/firebase';
import {
  COLLECTIONS,
  toAttendanceRecord,
  toClassMembership,
  toPermissionRequest,
  toPracticeClass,
  toPracticeSession,
  toUserProfile,
} from '@/services/firestore-schema';
import type {
  AttendanceRecord,
  ClassMembership,
  PermissionRequest,
  PermissionStatus,
  PracticeClass,
  PracticeSession,
  UserProfile,
} from '@/types';

/**
 * Layanan data dan operasi praktikum untuk asisten.
 *
 * Semua query memakai listener real-time `onSnapshot`. Penulisan data
 * (CRUD kelas, sesi, keputusan izin) dijaga dengan timeout agar tidak
 * menggantung saat offline.
 *
 * Query difilter berdasarkan `assistantIds` (kelas yang diampu) sehingga
 * cocok dengan Security Rules yang akan membatasi akses asisten.
 */

export interface SnapshotMeta {
  fromCache: boolean;
}

export type OnData<T> = (data: T, meta: SnapshotMeta) => void;
export type OnError = (error: unknown) => void;

const WRITE_TIMEOUT_MS = 15000;
const MAX_IN_VALUES = 30;

const bySchedule = (a: PracticeSession, b: PracticeSession) =>
  `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`);

// ---------------------------------------------------------------------------
// Kelas (classes) — Read & CRUD
// ---------------------------------------------------------------------------

/** Kelas yang diampu oleh asisten: `classes` where assistantIds array-contains uid. */
export function subscribeAssistantClasses(
  assistantUid: string,
  onData: OnData<PracticeClass[]>,
  onError: OnError,
): Unsubscribe {
  const q = query(
    collection(getDb(), COLLECTIONS.classes),
    where('assistantIds', 'array-contains', assistantUid),
  );
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snap: QuerySnapshot) =>
      onData(
        snap.docs
          .map(toPracticeClass)
          .sort((a: PracticeClass, b: PracticeClass) => a.name.localeCompare(b.name)),
        { fromCache: snap.metadata.fromCache },
      ),
    onError,
  );
}

/** Seluruh kelas praktikum (untuk asisten). */
export function subscribeAllClasses(
  onData: OnData<PracticeClass[]>,
  onError: OnError,
): Unsubscribe {
  const q = collection(getDb(), COLLECTIONS.classes);
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snap: QuerySnapshot) =>
      onData(
        snap.docs
          .map(toPracticeClass)
          .sort((a: PracticeClass, b: PracticeClass) => a.name.localeCompare(b.name)),
        { fromCache: snap.metadata.fromCache },
      ),
    onError,
  );
}

export interface CreateClassInput {
  name: string;
  practicalName: string;
}

export async function createClass(
  assistantUid: string,
  input: CreateClassInput,
): Promise<string> {
  const name = input.name.trim();
  const practicalName = input.practicalName.trim();
  if (!name) throw new AppError('invalid-input', 'Nama kelas wajib diisi.');
  if (!practicalName) throw new AppError('invalid-input', 'Nama mata praktikum wajib diisi.');

  const ref = await withTimeout<DocumentReference>(
    addDoc(collection(getDb(), COLLECTIONS.classes), {
      name,
      practicalName,
      assistantIds: [assistantUid],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
    WRITE_TIMEOUT_MS,
    'Gagal membuat kelas: koneksi ke server terlalu lama.',
  );
  return ref.id;
}

export async function updateClass(
  classId: string,
  input: Partial<CreateClassInput>,
): Promise<void> {
  const updates: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new AppError('invalid-input', 'Nama kelas wajib diisi.');
    updates.name = name;
  }
  if (input.practicalName !== undefined) {
    const practicalName = input.practicalName.trim();
    if (!practicalName) throw new AppError('invalid-input', 'Nama mata praktikum wajib diisi.');
    updates.practicalName = practicalName;
  }
  await withTimeout(
    updateDoc(doc(getDb(), COLLECTIONS.classes, classId), updates),
    WRITE_TIMEOUT_MS,
    'Gagal memperbarui kelas: koneksi ke server terlalu lama.',
  );
}

export async function deleteClass(classId: string): Promise<void> {
  await withTimeout(
    deleteDoc(doc(getDb(), COLLECTIONS.classes, classId)),
    WRITE_TIMEOUT_MS,
    'Gagal menghapus kelas: koneksi ke server terlalu lama.',
  );
}

// ---------------------------------------------------------------------------
// Peserta (classMembers) — Read & CRUD
// ---------------------------------------------------------------------------

/** Peserta pada kelas-kelas yang diampu asisten. */
export function subscribeClassMembers(
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
    (snap: QuerySnapshot) =>
      onData(
        snap.docs
          .map(toClassMembership)
          .sort((a: ClassMembership, b: ClassMembership) =>
            a.studentName.localeCompare(b.studentName),
          ),
        { fromCache: snap.metadata.fromCache },
      ),
    onError,
  );
}

export interface AddMemberInput {
  classId: string;
  className: string;
  studentId: string;
  studentName: string;
  studentIdentifier: string;
}

/** Cari akun praktikan terdaftar berdasarkan NIM tanpa meminta asisten memasukkan UID. */
export async function findStudentByIdentifier(identifier: string): Promise<UserProfile | null> {
  const nim = identifier.trim();
  if (!nim) throw new AppError('invalid-input', 'Masukkan NIM praktikan terlebih dahulu.');

  const snapshot = await getDocs(
    query(collection(getDb(), COLLECTIONS.users), where('identifier', '==', nim)),
  );
  const students = snapshot.docs
    .map(toUserProfile)
    .filter((profile): profile is UserProfile => profile?.role === 'praktikan');

  if (students.length > 1) {
    throw new AppError(
      'duplicate-student-identifier',
      'NIM ini terdaftar pada lebih dari satu akun praktikan. Periksa data pengguna di Firebase.',
    );
  }

  return students[0] ?? null;
}

export async function addClassMember(input: AddMemberInput): Promise<string> {
  if (!input.studentId.trim()) throw new AppError('invalid-input', 'UID praktikan wajib diisi.');
  if (!input.studentName.trim()) throw new AppError('invalid-input', 'Nama praktikan wajib diisi.');
  if (!input.studentIdentifier.trim()) {
    throw new AppError('invalid-input', 'NIM praktikan wajib diisi.');
  }

  const memberId = `${input.classId}_${input.studentId.trim()}`;
  const ref = doc(getDb(), COLLECTIONS.classMembers, memberId);
  await withTimeout(
    setDoc(ref, {
      classId: input.classId,
      className: input.className.trim(),
      studentId: input.studentId.trim(),
      studentName: input.studentName.trim(),
      studentIdentifier: input.studentIdentifier.trim(),
      createdAt: serverTimestamp(),
    }),
    WRITE_TIMEOUT_MS,
    'Gagal menambahkan peserta: koneksi ke server terlalu lama.',
  );
  return memberId;
}

export async function removeClassMember(memberId: string): Promise<void> {
  await withTimeout(
    deleteDoc(doc(getDb(), COLLECTIONS.classMembers, memberId)),
    WRITE_TIMEOUT_MS,
    'Gagal menghapus peserta: koneksi ke server terlalu lama.',
  );
}

// ---------------------------------------------------------------------------
// Sesi (sessions) — Read & CRUD & Manajemen Status
// ---------------------------------------------------------------------------

/** Sesi pada kelas-kelas yang diampu asisten, terurut berdasarkan jadwal. */
export function subscribeAssistantSessions(
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
    (snap: QuerySnapshot) =>
      onData(snap.docs.map(toPracticeSession).sort(bySchedule), {
        fromCache: snap.metadata.fromCache,
      }),
    onError,
  );
}

/** Satu sesi (real-time). */
export function subscribeSession(
  sessionId: string,
  onData: OnData<PracticeSession | null>,
  onError: OnError,
): Unsubscribe {
  return onSnapshot(
    doc(getDb(), COLLECTIONS.sessions, sessionId),
    { includeMetadataChanges: true },
    (snap: DocumentSnapshot) =>
      onData(snap.exists() ? toPracticeSession(snap) : null, {
        fromCache: snap.metadata.fromCache,
      }),
    onError,
  );
}

export interface CreateSessionInput {
  classId: string;
  practicalName: string;
  className: string;
  labId?: string;
  labName?: string;
  date: string;
  startTime: string;
  endTime: string;
  topic?: string;
  room?: string;
  assistantName?: string;
}

export type UpdateSessionInput = Partial<Omit<CreateSessionInput, 'classId'>>;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validateSessionInput(input: CreateSessionInput): string | null {
  if (!input.classId) return 'Kelas wajib dipilih.';
  if (!input.labId?.trim()) {
    return 'Laboratorium wajib dipilih agar presensi lokasi dan peta aktif.';
  }
  const date = input.date.trim();
  const startTime = input.startTime.trim();
  const endTime = input.endTime.trim();
  if (!date) return 'Tanggal wajib diisi.';
  if (!DATE_PATTERN.test(date)) return 'Format tanggal harus YYYY-MM-DD (mis. 2026-11-25).';
  if (!startTime) return 'Waktu mulai wajib diisi.';
  if (!TIME_PATTERN.test(startTime)) return 'Format waktu mulai harus HH:mm (mis. 08:00).';
  if (!endTime) return 'Waktu selesai wajib diisi.';
  if (!TIME_PATTERN.test(endTime)) return 'Format waktu selesai harus HH:mm (mis. 10:00).';
  if (startTime >= endTime) return 'Waktu mulai harus sebelum waktu selesai.';
  return null;
}

export async function createSession(input: CreateSessionInput): Promise<string> {
  const error = validateSessionInput(input);
  if (error) throw new AppError('invalid-input', error);

  const labId = input.labId?.trim() || null;
  const labName = input.labName?.trim() || null;
  const ref = await withTimeout<DocumentReference>(
    addDoc(collection(getDb(), COLLECTIONS.sessions), {
      classId: input.classId,
      labId,
      labName,
      practicalName: input.practicalName.trim(),
      className: input.className.trim(),
      date: input.date.trim(),
      startTime: input.startTime.trim(),
      endTime: input.endTime.trim(),
      status: 'scheduled',
      topic: input.topic?.trim() || null,
      room: input.room?.trim() || labName || null,
      assistantName: input.assistantName?.trim() || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
    WRITE_TIMEOUT_MS,
    'Gagal membuat sesi: koneksi ke server terlalu lama.',
  );
  return ref.id;
}

export async function updateSession(
  sessionId: string,
  updates: UpdateSessionInput,
): Promise<void> {
  const data: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (updates.practicalName !== undefined) data.practicalName = updates.practicalName.trim();
  if (updates.className !== undefined) data.className = updates.className.trim();
  if (updates.labId !== undefined) {
    const labId = updates.labId.trim();
    if (!labId) throw new AppError('invalid-input', 'Laboratorium wajib dipilih.');
    data.labId = labId;
  }
  if (updates.labName !== undefined) data.labName = updates.labName.trim() || null;
  if (updates.date !== undefined) {
    const date = updates.date.trim();
    if (!DATE_PATTERN.test(date)) {
      throw new AppError('invalid-input', 'Format tanggal harus YYYY-MM-DD (mis. 2026-11-25).');
    }
    data.date = date;
  }
  if (updates.startTime !== undefined) {
    const startTime = updates.startTime.trim();
    if (!TIME_PATTERN.test(startTime)) {
      throw new AppError('invalid-input', 'Format waktu mulai harus HH:mm (mis. 08:00).');
    }
    data.startTime = startTime;
  }
  if (updates.endTime !== undefined) {
    const endTime = updates.endTime.trim();
    if (!TIME_PATTERN.test(endTime)) {
      throw new AppError('invalid-input', 'Format waktu selesai harus HH:mm (mis. 10:00).');
    }
    data.endTime = endTime;
  }
  if (
    typeof data.startTime === 'string' &&
    typeof data.endTime === 'string' &&
    data.startTime >= data.endTime
  ) {
    throw new AppError('invalid-input', 'Waktu mulai harus sebelum waktu selesai.');
  }
  if (updates.topic !== undefined) data.topic = updates.topic?.trim() || null;
  if (updates.room !== undefined) data.room = updates.room?.trim() || null;
  if (updates.assistantName !== undefined) {
    data.assistantName = updates.assistantName?.trim() || null;
  }

  await withTimeout(
    updateDoc(doc(getDb(), COLLECTIONS.sessions, sessionId), data),
    WRITE_TIMEOUT_MS,
    'Gagal memperbarui sesi: koneksi ke server terlalu lama.',
  );
}

/** Membaca satu sesi secara langsung sebagai fallback saat daftar belum termuat penuh. */
export async function getSessionById(sessionId: string): Promise<PracticeSession | null> {
  const snap = await withTimeout(
    getDoc(doc(getDb(), COLLECTIONS.sessions, sessionId)),
    WRITE_TIMEOUT_MS,
    'Waktu pembacaan detail sesi habis.',
  );
  return snap.exists() ? toPracticeSession(snap) : null;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await withTimeout(
    deleteDoc(doc(getDb(), COLLECTIONS.sessions, sessionId)),
    WRITE_TIMEOUT_MS,
    'Gagal menghapus sesi: koneksi ke server terlalu lama.',
  );
}

/** Buka atau tutup sesi. Hanya asisten berwenang yang memanggil fungsi ini. */
export async function updateSessionStatus(
  sessionId: string,
  status: 'open' | 'closed',
): Promise<void> {
  await withTimeout(
    updateDoc(doc(getDb(), COLLECTIONS.sessions, sessionId), {
      status,
      updatedAt: serverTimestamp(),
    }),
    WRITE_TIMEOUT_MS,
    `Gagal ${status === 'open' ? 'membuka' : 'menutup'} sesi: koneksi ke server terlalu lama.`,
  );
}

// ---------------------------------------------------------------------------
// Presensi (attendance) — Read
// ---------------------------------------------------------------------------

/** Seluruh presensi pada kelas-kelas yang diampu asisten. */
export function subscribeAttendanceForClasses(
  classIds: string[],
  onData: OnData<AttendanceRecord[]>,
  onError: OnError,
): Unsubscribe {
  const ids = [...new Set(classIds)].slice(0, MAX_IN_VALUES);
  if (ids.length === 0) {
    onData([], { fromCache: false });
    return () => undefined;
  }
  const q = query(collection(getDb(), COLLECTIONS.attendance), where('classId', 'in', ids));
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snap: QuerySnapshot) =>
      onData(
        snap.docs
          .map(toAttendanceRecord)
          .sort((a: AttendanceRecord, b: AttendanceRecord) =>
            (b.attendanceTime ?? '').localeCompare(a.attendanceTime ?? ''),
          ),
        { fromCache: snap.metadata.fromCache },
      ),
    onError,
  );
}

// ---------------------------------------------------------------------------
// Pengajuan izin (permissionRequests) — Read & Keputusan
// ---------------------------------------------------------------------------

/** Semua pengajuan izin dari kelas-kelas yang diampu asisten. */
export function subscribePermissionRequestsForClasses(
  classIds: string[],
  onData: OnData<PermissionRequest[]>,
  onError: OnError,
): Unsubscribe {
  const ids = [...new Set(classIds)].slice(0, MAX_IN_VALUES);
  if (ids.length === 0) {
    onData([], { fromCache: false });
    return () => undefined;
  }
  const q = query(
    collection(getDb(), COLLECTIONS.permissionRequests),
    where('classId', 'in', ids),
  );
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snap: QuerySnapshot) =>
      onData(
        snap.docs
          .map(toPermissionRequest)
          .sort((a: PermissionRequest, b: PermissionRequest) =>
            (b.createdAt ?? '').localeCompare(a.createdAt ?? ''),
          ),
        { fromCache: snap.metadata.fromCache },
      ),
    onError,
  );
}

/**
 * Keputusan asisten atas pengajuan izin.
 * Menyimpan status baru, identitas pengambil keputusan, dan catatan opsional.
 * Keputusan AI TIDAK menentukan hasil akhir — hanya asisten yang memutuskan.
 */
export async function decidePermissionRequest(
  requestId: string,
  decision: PermissionStatus,
  assistant: UserProfile,
  note?: string,
): Promise<void> {
  if (decision === 'pending') {
    throw new AppError('invalid-input', 'Status keputusan tidak valid.');
  }

  await withTimeout(
    updateDoc(doc(getDb(), COLLECTIONS.permissionRequests, requestId), {
      status: decision,
      decidedBy: assistant.uid,
      decidedByName: assistant.name,
      decidedAt: serverTimestamp(),
      decisionNote: note?.trim() || null,
      updatedAt: serverTimestamp(),
    }),
    WRITE_TIMEOUT_MS,
    'Gagal menyimpan keputusan izin: koneksi ke server terlalu lama.',
  );
}

/** Membaca satu pengajuan izin secara langsung sebagai fallback pengiriman notifikasi. */
export async function getPermissionRequestById(
  requestId: string,
): Promise<PermissionRequest | null> {
  const snap = await withTimeout(
    getDoc(doc(getDb(), COLLECTIONS.permissionRequests, requestId)),
    WRITE_TIMEOUT_MS,
    'Waktu pembacaan data izin habis.',
  );
  return snap.exists() ? toPermissionRequest(snap) : null;
}

