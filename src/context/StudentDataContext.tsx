import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { useAuth } from '@/context/AuthContext';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { getErrorMessage } from '@/services/errors';
import {
  subscribeClassesByIds,
  subscribeClassParticipants,
  subscribeSessionsForClasses,
  subscribeStudentAttendance,
  subscribeStudentMemberships,
  subscribeStudentPermissionRequests,
} from '@/services/student-data-service';
import type {
  AttendanceRecord,
  ClassMembership,
  PermissionRequest,
  PracticeClass,
  PracticeSession,
} from '@/types';

/**
 * Provider data real-time khusus praktikan (PIC: Programmer 1).
 *
 * Hanya berlangganan koleksi milik praktikan yang sedang login:
 * - `classMembers` (keanggotaan kelas praktikan)
 * - `classes` & daftar peserta pada kelas-kelas yang diikuti
 * - `sessions` pada kelas-kelas yang diikuti (real-time perubahan status buka/tutup)
 * - `attendance` milik praktikan
 * - `permissionRequests` milik praktikan (real-time perubahan status keputusan & AI)
 */
interface StudentDataValue {
  memberships: ClassMembership[];
  classes: PracticeClass[];
  classParticipants: ClassMembership[];
  sessions: PracticeSession[];
  attendance: AttendanceRecord[];
  permissionRequests: PermissionRequest[];
  /** Ringkasan nama kelas praktikan (mis. "TI-3A" atau "TI-3A, TI-3B"). */
  classNamesLabel: string;
  loading: boolean;
  error: string | null;
  fromCache: boolean;
  isOffline: boolean;
  retry: () => void;
}

interface KeyedData<T> {
  key: string;
  data: T;
  fromCache: boolean;
}

const StudentDataContext = createContext<StudentDataValue | null>(null);

export function StudentDataProvider({ children }: PropsWithChildren) {
  const { status, profile } = useAuth();
  const { isOffline } = useNetworkStatus();
  const isStudent = status === 'authenticated' && profile?.role === 'praktikan';
  const studentUid = isStudent ? profile.uid : null;

  const [retryKey, setRetryKey] = useState(0);
  const [errorState, setErrorState] = useState<{ key: string; message: string } | null>(null);

  const userScopeKey = studentUid ? `${studentUid}:${retryKey}` : null;

  const [membershipsSnap, setMembershipsSnap] = useState<KeyedData<ClassMembership[]> | null>(null);
  const [attendanceSnap, setAttendanceSnap] = useState<KeyedData<AttendanceRecord[]> | null>(null);
  const [permissionsSnap, setPermissionsSnap] = useState<KeyedData<PermissionRequest[]> | null>(null);
  const [sessionsSnap, setSessionsSnap] = useState<KeyedData<PracticeSession[]> | null>(null);
  const [classesSnap, setClassesSnap] = useState<KeyedData<PracticeClass[]> | null>(null);
  const [participantsSnap, setParticipantsSnap] = useState<KeyedData<ClassMembership[]> | null>(null);

  // 1. Listener keanggotaan kelas, presensi, dan pengajuan izin milik praktikan.
  useEffect(() => {
    if (!studentUid || !userScopeKey) return undefined;

    const handleError = (err: unknown) => {
      setErrorState({
        key: userScopeKey,
        message: getErrorMessage(err, 'Gagal memuat data praktikan dari server.'),
      });
    };

    const unsubMemberships = subscribeStudentMemberships(
      studentUid,
      (data, meta) => setMembershipsSnap({ key: userScopeKey, data, fromCache: meta.fromCache }),
      handleError,
    );

    const unsubAttendance = subscribeStudentAttendance(
      studentUid,
      (data, meta) => setAttendanceSnap({ key: userScopeKey, data, fromCache: meta.fromCache }),
      handleError,
    );

    const unsubPermissions = subscribeStudentPermissionRequests(
      studentUid,
      (data, meta) => setPermissionsSnap({ key: userScopeKey, data, fromCache: meta.fromCache }),
      handleError,
    );

    return () => {
      unsubMemberships();
      unsubAttendance();
      unsubPermissions();
    };
  }, [studentUid, userScopeKey]);

  const membershipsLoaded = Boolean(userScopeKey && membershipsSnap?.key === userScopeKey);
  const memberships = useMemo(
    () => (membershipsLoaded && membershipsSnap ? membershipsSnap.data : []),
    [membershipsLoaded, membershipsSnap],
  );

  const classIdsKey = useMemo(
    () =>
      [...new Set(memberships.map((m) => m.classId))]
        .filter(Boolean)
        .sort()
        .join(','),
    [memberships],
  );

  const classScopeKey = userScopeKey && classIdsKey ? `${userScopeKey}:${classIdsKey}` : null;

  // 2. Listener kelas, peserta, dan sesi berdasarkan daftar classId yang diikuti praktikan.
  useEffect(() => {
    if (!classScopeKey || !classIdsKey || !userScopeKey) return undefined;

    const classIds = classIdsKey.split(',');

    const unsubSessions = subscribeSessionsForClasses(
      classIds,
      (data, meta) => setSessionsSnap({ key: classScopeKey, data, fromCache: meta.fromCache }),
      (err) =>
        setErrorState({
          key: userScopeKey,
          message: getErrorMessage(err, 'Gagal memuat jadwal sesi praktikum.'),
        }),
    );

    const unsubClasses = subscribeClassesByIds(
      classIds,
      (data, meta) => setClassesSnap({ key: classScopeKey, data, fromCache: meta.fromCache }),
      () => undefined,
    );

    const unsubParticipants = subscribeClassParticipants(
      classIds,
      (data, meta) => setParticipantsSnap({ key: classScopeKey, data, fromCache: meta.fromCache }),
      () => undefined,
    );

    return () => {
      unsubSessions();
      unsubClasses();
      unsubParticipants();
    };
  }, [classScopeKey, classIdsKey, userScopeKey]);

  const retry = useCallback(() => {
    setRetryKey((prev) => prev + 1);
  }, []);

  const attendanceLoaded = Boolean(userScopeKey && attendanceSnap?.key === userScopeKey);
  const permissionsLoaded = Boolean(userScopeKey && permissionsSnap?.key === userScopeKey);
  const sessionsLoaded = Boolean(
    userScopeKey &&
      membershipsLoaded &&
      (!classScopeKey || sessionsSnap?.key === classScopeKey),
  );

  const attendance = useMemo(
    () => (attendanceLoaded && attendanceSnap ? attendanceSnap.data : []),
    [attendanceLoaded, attendanceSnap],
  );
  const permissionRequests = useMemo(
    () => (permissionsLoaded && permissionsSnap ? permissionsSnap.data : []),
    [permissionsLoaded, permissionsSnap],
  );
  const sessions = useMemo(
    () => (classScopeKey && sessionsSnap?.key === classScopeKey ? sessionsSnap.data : []),
    [classScopeKey, sessionsSnap],
  );
  const classes = useMemo(
    () => (classScopeKey && classesSnap?.key === classScopeKey ? classesSnap.data : []),
    [classScopeKey, classesSnap],
  );
  const classParticipants = useMemo(
    () => (classScopeKey && participantsSnap?.key === classScopeKey ? participantsSnap.data : []),
    [classScopeKey, participantsSnap],
  );

  const error = userScopeKey && errorState?.key === userScopeKey ? errorState.message : null;
  const fromCache = Boolean(
    (membershipsLoaded && membershipsSnap?.fromCache) ||
      (attendanceLoaded && attendanceSnap?.fromCache) ||
      (permissionsLoaded && permissionsSnap?.fromCache) ||
      (classScopeKey && sessionsSnap?.key === classScopeKey && sessionsSnap.fromCache),
  );

  const classNamesLabel = useMemo(() => {
    const names = [...new Set(memberships.map((m) => m.className).filter(Boolean))];
    return names.length > 0 ? names.join(', ') : 'Belum terdaftar di kelas';
  }, [memberships]);

  const loading = Boolean(
    userScopeKey &&
      !error &&
      (!membershipsLoaded || !sessionsLoaded || !attendanceLoaded || !permissionsLoaded),
  );

  const value = useMemo<StudentDataValue>(
    () => ({
      memberships,
      classes,
      classParticipants,
      sessions,
      attendance,
      permissionRequests,
      classNamesLabel,
      loading,
      error,
      fromCache,
      isOffline,
      retry,
    }),
    [
      memberships,
      classes,
      classParticipants,
      sessions,
      attendance,
      permissionRequests,
      classNamesLabel,
      loading,
      error,
      fromCache,
      isOffline,
      retry,
    ],
  );

  return <StudentDataContext.Provider value={value}>{children}</StudentDataContext.Provider>;
}

export function useStudentData(): StudentDataValue {
  const ctx = useContext(StudentDataContext);
  if (!ctx) {
    throw new Error('useStudentData harus digunakan di dalam StudentDataProvider.');
  }
  return ctx;
}
