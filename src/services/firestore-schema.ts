import { Timestamp, type DocumentData, type DocumentSnapshot } from 'firebase/firestore';

import type {
  AiClassification,
  AiClassificationStatus,
  AttendanceRecord,
  ClassMembership,
  PermissionRequest,
  PermissionStatus,
  PracticeClass,
  PracticeSession,
  SessionStatus,
  UserProfile,
  UserRole,
} from '@/types';
import { nowLocalDateTime } from '@/utils/format';

/**
 * Kontrak nama koleksi & pembentuk ID dokumen Firestore.
 * Dipakai bersama alur praktikan (Programmer 1) dan asisten (Programmer 2).
 * Detail field: `docs/Firestore Schema.md`.
 */
export const COLLECTIONS = {
  users: 'users',
  classes: 'classes',
  classMembers: 'classMembers',
  schedules: 'sessions',
  sessions: 'sessions',
  attendance: 'attendance',
  permissionRequests: 'permissionRequests',
} as const;

/** `classMembers/{classId}_{studentId}` */
export const classMemberId = (classId: string, studentId: string) => `${classId}_${studentId}`;

/** `attendance/{sessionId}_{studentId}` — deterministik agar presensi ganda mustahil. */
export const attendanceId = (sessionId: string, studentId: string) => `${sessionId}_${studentId}`;

/** `permissionRequests/{sessionId}_{studentId}` — satu pengajuan per sesi per praktikan. */
export const permissionRequestId = (sessionId: string, studentId: string) => `${sessionId}_${studentId}`;

// ---------------------------------------------------------------------------
// Mapper dokumen → tipe aplikasi (defensif terhadap field yang hilang)
// ---------------------------------------------------------------------------

const SESSION_STATUSES: SessionStatus[] = ['scheduled', 'open', 'closed'];
const PERMISSION_STATUSES: PermissionStatus[] = ['pending', 'approved', 'rejected'];
const AI_STATUSES: AiClassificationStatus[] = ['pending', 'success', 'failed', 'skipped'];
const ROLES: UserRole[] = ['praktikan', 'asisten'];

const str = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);
const optStr = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

/** Timestamp Firestore → "YYYY-MM-DDTHH:mm:ss" waktu lokal (null bila kosong). */
export function timestampToLocal(value: unknown): string | null {
  if (value instanceof Timestamp) return nowLocalDateTime(value.toDate());
  if (value instanceof Date) return nowLocalDateTime(value);
  return null;
}

/**
 * Ambil data dengan estimasi serverTimestamp agar field waktu tidak null
 * saat tulis lokal belum dikonfirmasi server.
 */
function readData(snap: DocumentSnapshot): DocumentData {
  return snap.data({ serverTimestamps: 'estimate' }) ?? {};
}

export function toUserProfile(snap: DocumentSnapshot): UserProfile | null {
  if (!snap.exists()) return null;
  const d = readData(snap);
  const role = ROLES.includes(d.role) ? (d.role as UserRole) : null;
  if (!role) return null;
  return {
    uid: snap.id,
    name: str(d.name, 'Tanpa Nama'),
    email: str(d.email),
    identifier: str(d.identifier, '-'),
    role,
    createdAt: timestampToLocal(d.createdAt),
  };
}

export function toPracticeClass(snap: DocumentSnapshot): PracticeClass {
  const d = readData(snap);
  const assistantIds = Array.isArray(d.assistantIds)
    ? d.assistantIds.filter((item): item is string => typeof item === 'string')
    : [];
  return {
    id: snap.id,
    name: str(d.name, '-'),
    practicalName: str(d.practicalName, 'Praktikum'),
    assistantIds,
  };
}

export function toClassMembership(snap: DocumentSnapshot): ClassMembership {
  const d = readData(snap);
  return {
    id: snap.id,
    classId: str(d.classId),
    className: str(d.className, '-'),
    studentId: str(d.studentId),
    studentName: str(d.studentName),
    studentIdentifier: str(d.studentIdentifier),
  };
}

export function toPracticeSession(snap: DocumentSnapshot): PracticeSession {
  const d = readData(snap);
  return {
    id: snap.id,
    classId: str(d.classId),
    practicalName: str(d.practicalName, 'Praktikum'),
    className: str(d.className, '-'),
    date: str(d.date),
    startTime: str(d.startTime, '--:--'),
    endTime: str(d.endTime, '--:--'),
    status: SESSION_STATUSES.includes(d.status) ? (d.status as SessionStatus) : 'scheduled',
    topic: optStr(d.topic),
    room: optStr(d.room),
    assistantName: optStr(d.assistantName),
  };
}

export function toAttendanceRecord(snap: DocumentSnapshot): AttendanceRecord {
  const d = readData(snap);
  return {
    id: snap.id,
    sessionId: str(d.sessionId),
    classId: optStr(d.classId),
    studentId: str(d.studentId),
    studentName: str(d.studentName),
    studentIdentifier: optStr(d.studentIdentifier),
    attendanceTime: timestampToLocal(d.attendedAt) ?? nowLocalDateTime(),
  };
}

function toAiClassification(value: unknown): AiClassification {
  const d = (value ?? {}) as Record<string, unknown>;
  return {
    status: AI_STATUSES.includes(d.status as AiClassificationStatus)
      ? (d.status as AiClassificationStatus)
      : 'pending',
    category: optStr(d.category) ?? null,
    confidence: typeof d.confidence === 'number' ? d.confidence : null,
    error: optStr(d.error) ?? null,
  };
}

export function toPermissionRequest(snap: DocumentSnapshot): PermissionRequest {
  const d = readData(snap);
  return {
    id: snap.id,
    sessionId: str(d.sessionId),
    classId: str(d.classId),
    studentId: str(d.studentId),
    studentName: str(d.studentName),
    studentIdentifier: str(d.studentIdentifier),
    practicalName: str(d.practicalName, 'Praktikum'),
    className: str(d.className, '-'),
    sessionDate: str(d.sessionDate),
    reason: str(d.reason),
    status: PERMISSION_STATUSES.includes(d.status) ? (d.status as PermissionStatus) : 'pending',
    aiClassification: toAiClassification(d.aiClassification),
    createdAt: timestampToLocal(d.createdAt),
    decidedAt: timestampToLocal(d.decidedAt),
    decidedBy: optStr(d.decidedBy) ?? null,
    decidedByName: optStr(d.decidedByName) ?? null,
    decisionNote: optStr(d.decisionNote) ?? null,
  };
}

