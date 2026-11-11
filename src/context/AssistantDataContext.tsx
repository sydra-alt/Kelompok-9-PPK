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
import {
  addClassMember as serviceAddClassMember,
  createClass as serviceCreateClass,
  createSession as serviceCreateSession,
  decidePermissionRequest as serviceDecidePermission,
  deleteClass as serviceDeleteClass,
  deleteSession as serviceDeleteSession,
  removeClassMember as serviceRemoveClassMember,
  subscribeAllClasses,
  subscribeAssistantClasses,
  subscribeAssistantSessions,
  subscribeAttendanceForClasses,
  subscribeClassMembers,
  subscribePermissionRequestsForClasses,
  updateClass as serviceUpdateClass,
  updateSession as serviceUpdateSession,
  updateSessionStatus as serviceUpdateSessionStatus,
  type AddMemberInput,
  type CreateClassInput,
  type CreateSessionInput,
} from '@/services/assistant-data-service';
import { getErrorMessage } from '@/services/errors';
import type {
  AttendanceRecord,
  ClassMembership,
  PermissionRequest,
  PermissionStatus,
  PracticeClass,
  PracticeSession,
  SessionStatus,
} from '@/types';

/**
 * Provider data real-time khusus asisten (PIC: Programmer 2).
 *
 * Mengelola langganan Firestore real-time untuk:
 * - Kelas praktikum (`classes`) yang diampu asisten
 * - Peserta kelas (`classMembers`)
 * - Sesi pertemuan (`sessions`)
 * - Rekap presensi (`attendance`)
 * - Pengajuan izin praktikan (`permissionRequests`)
 */

interface AssistantDataContextValue {
  classes: PracticeClass[];
  sessions: PracticeSession[];
  attendance: AttendanceRecord[];
  permissionRequests: PermissionRequest[];
  members: ClassMembership[];
  loading: boolean;
  error: string | null;
  fromCache: boolean;
  isOffline: boolean;
  retry: () => void;
  // CRUD Kelas
  createClass: (input: CreateClassInput) => Promise<string>;
  updateClass: (classId: string, input: Partial<CreateClassInput>) => Promise<void>;
  deleteClass: (classId: string) => Promise<void>;
  // CRUD Peserta
  addMember: (input: AddMemberInput) => Promise<string>;
  removeMember: (memberId: string) => Promise<void>;
  // CRUD Sesi & Status
  createSession: (input: CreateSessionInput) => Promise<string>;
  updateSession: (sessionId: string, updates: Partial<Omit<CreateSessionInput, 'classId'>>) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  setSessionStatus: (sessionId: string, status: SessionStatus) => Promise<void>;
  // Keputusan Izin
  decidePermission: (requestId: string, decision: PermissionStatus, note?: string) => Promise<void>;
}

interface KeyedData<T> {
  key: string;
  data: T;
  fromCache: boolean;
}

const AssistantDataContext = createContext<AssistantDataContextValue | null>(null);

export function AssistantDataProvider({ children }: PropsWithChildren) {
  const { status, profile } = useAuth();
  const { isOffline } = useNetworkStatus();

  const isAssistant = status === 'authenticated' && profile?.role === 'asisten';
  const assistantUid = isAssistant ? profile.uid : null;

  const [retryKey, setRetryKey] = useState(0);
  const [errorState, setErrorState] = useState<{ key: string; message: string } | null>(null);

  const assistantScopeKey = assistantUid ? `${assistantUid}:${retryKey}` : null;

  const [classesSnap, setClassesSnap] = useState<KeyedData<PracticeClass[]> | null>(null);
  const [membersSnap, setMembersSnap] = useState<KeyedData<ClassMembership[]> | null>(null);
  const [sessionsSnap, setSessionsSnap] = useState<KeyedData<PracticeSession[]> | null>(null);
  const [attendanceSnap, setAttendanceSnap] = useState<KeyedData<AttendanceRecord[]> | null>(null);
  const [permissionsSnap, setPermissionsSnap] = useState<KeyedData<PermissionRequest[]> | null>(null);

  // 1. Berlangganan kelas yang diampu asisten (jika belum ada, coba subscribe all classes)
  useEffect(() => {
    if (!assistantUid || !assistantScopeKey) return undefined;

    const handleError = (err: unknown) => {
      setErrorState({
        key: assistantScopeKey,
        message: getErrorMessage(err, 'Gagal memuat kelas yang diampu dari server.'),
      });
    };

    // Coba dengarkan kelas asisten; jika kosong atau asisten mengampu kelas
    let unsubAll: (() => void) | null = null;
    const unsubClasses = subscribeAssistantClasses(
      assistantUid,
      (data, meta) => {
        if (data.length === 0) {
          // Jika tidak ada kelas dengan assistantIds, dengarkan seluruh kelas
          if (!unsubAll) {
            unsubAll = subscribeAllClasses(
              (allData, allMeta) => {
                setClassesSnap({ key: assistantScopeKey, data: allData, fromCache: allMeta.fromCache });
              },
              () => {
                setClassesSnap({ key: assistantScopeKey, data: [], fromCache: meta.fromCache });
              },
            );
          }
        } else {
          if (unsubAll) {
            unsubAll();
            unsubAll = null;
          }
          setClassesSnap({ key: assistantScopeKey, data, fromCache: meta.fromCache });
        }
      },
      handleError,
    );

    return () => {
      unsubClasses();
      if (unsubAll) unsubAll();
    };
  }, [assistantUid, assistantScopeKey]);

  const classesLoaded = Boolean(assistantScopeKey && classesSnap?.key === assistantScopeKey);
  const classes = useMemo(
    () => (classesLoaded && classesSnap ? classesSnap.data : []),
    [classesLoaded, classesSnap],
  );

  const classIdsKey = useMemo(
    () =>
      [...new Set(classes.map((c) => c.id))]
        .filter(Boolean)
        .sort()
        .join(','),
    [classes],
  );

  const classScopeKey = assistantScopeKey && classIdsKey ? `${assistantScopeKey}:${classIdsKey}` : null;

  // 2. Berlangganan sesi, peserta, presensi, dan pengajuan izin untuk kelas-kelas asisten
  useEffect(() => {
    if (!classScopeKey || !classIdsKey || !assistantScopeKey) return undefined;

    const classIds = classIdsKey.split(',');

    const unsubSessions = subscribeAssistantSessions(
      classIds,
      (data, meta) => setSessionsSnap({ key: classScopeKey, data, fromCache: meta.fromCache }),
      (err) =>
        setErrorState({
          key: assistantScopeKey,
          message: getErrorMessage(err, 'Gagal memuat sesi praktikum.'),
        }),
    );

    const unsubMembers = subscribeClassMembers(
      classIds,
      (data, meta) => setMembersSnap({ key: classScopeKey, data, fromCache: meta.fromCache }),
      () => undefined,
    );

    const unsubAttendance = subscribeAttendanceForClasses(
      classIds,
      (data, meta) => setAttendanceSnap({ key: classScopeKey, data, fromCache: meta.fromCache }),
      (err) =>
        setErrorState({
          key: assistantScopeKey,
          message: getErrorMessage(err, 'Gagal memuat rekap presensi.'),
        }),
    );

    const unsubPermissions = subscribePermissionRequestsForClasses(
      classIds,
      (data, meta) => setPermissionsSnap({ key: classScopeKey, data, fromCache: meta.fromCache }),
      (err) =>
        setErrorState({
          key: assistantScopeKey,
          message: getErrorMessage(err, 'Gagal memuat pengajuan izin.'),
        }),
    );

    return () => {
      unsubSessions();
      unsubMembers();
      unsubAttendance();
      unsubPermissions();
    };
  }, [classScopeKey, classIdsKey, assistantScopeKey]);

  const retry = useCallback(() => {
    setRetryKey((prev) => prev + 1);
  }, []);

  const sessionsLoaded = Boolean(
    assistantScopeKey &&
      classesLoaded &&
      (!classScopeKey || sessionsSnap?.key === classScopeKey),
  );
  const membersLoaded = Boolean(
    assistantScopeKey &&
      classesLoaded &&
      (!classScopeKey || membersSnap?.key === classScopeKey),
  );
  const attendanceLoaded = Boolean(
    assistantScopeKey &&
      classesLoaded &&
      (!classScopeKey || attendanceSnap?.key === classScopeKey),
  );
  const permissionsLoaded = Boolean(
    assistantScopeKey &&
      classesLoaded &&
      (!classScopeKey || permissionsSnap?.key === classScopeKey),
  );

  const sessions = useMemo(
    () => (classScopeKey && sessionsSnap?.key === classScopeKey ? sessionsSnap.data : []),
    [classScopeKey, sessionsSnap],
  );
  const members = useMemo(
    () => (classScopeKey && membersSnap?.key === classScopeKey ? membersSnap.data : []),
    [classScopeKey, membersSnap],
  );
  const attendance = useMemo(
    () => (classScopeKey && attendanceSnap?.key === classScopeKey ? attendanceSnap.data : []),
    [classScopeKey, attendanceSnap],
  );
  const permissionRequests = useMemo(
    () => (classScopeKey && permissionsSnap?.key === classScopeKey ? permissionsSnap.data : []),
    [classScopeKey, permissionsSnap],
  );

  const error = assistantScopeKey && errorState?.key === assistantScopeKey ? errorState.message : null;
  const fromCache = Boolean(
    (classesLoaded && classesSnap?.fromCache) ||
      (sessionsLoaded && sessionsSnap?.fromCache) ||
      (attendanceLoaded && attendanceSnap?.fromCache) ||
      (permissionsLoaded && permissionsSnap?.fromCache),
  );

  const loading = Boolean(
    assistantScopeKey &&
      !error &&
      (!classesLoaded ||
        !sessionsLoaded ||
        !attendanceLoaded ||
        !permissionsLoaded ||
        !membersLoaded),
  );

  // CRUD actions
  const createClass = useCallback(
    async (input: CreateClassInput) => {
      if (!profile) throw new Error('Profil asisten tidak ditemukan.');
      return serviceCreateClass(profile.uid, input);
    },
    [profile],
  );

  const updateClass = useCallback(async (classId: string, input: Partial<CreateClassInput>) => {
    return serviceUpdateClass(classId, input);
  }, []);

  const deleteClass = useCallback(async (classId: string) => {
    return serviceDeleteClass(classId);
  }, []);

  const addMember = useCallback(async (input: AddMemberInput) => {
    return serviceAddClassMember(input);
  }, []);

  const removeMember = useCallback(async (memberId: string) => {
    return serviceRemoveClassMember(memberId);
  }, []);

  const createSession = useCallback(async (input: CreateSessionInput) => {
    return serviceCreateSession(input);
  }, []);

  const updateSession = useCallback(
    async (sessionId: string, updates: Partial<Omit<CreateSessionInput, 'classId'>>) => {
      return serviceUpdateSession(sessionId, updates);
    },
    [],
  );

  const deleteSession = useCallback(async (sessionId: string) => {
    return serviceDeleteSession(sessionId);
  }, []);

  const setSessionStatus = useCallback(async (sessionId: string, status: SessionStatus) => {
    if (status === 'scheduled') {
      throw new Error('Status tidak dapat dikembalikan ke scheduled.');
    }
    return serviceUpdateSessionStatus(sessionId, status);
  }, []);

  const decidePermission = useCallback(
    async (requestId: string, decision: PermissionStatus, note?: string) => {
      if (!profile) throw new Error('Profil asisten tidak ditemukan.');
      return serviceDecidePermission(requestId, decision, profile, note);
    },
    [profile],
  );

  const value = useMemo<AssistantDataContextValue>(
    () => ({
      classes,
      sessions,
      attendance,
      permissionRequests,
      members,
      loading,
      error,
      fromCache,
      isOffline,
      retry,
      createClass,
      updateClass,
      deleteClass,
      addMember,
      removeMember,
      createSession,
      updateSession,
      deleteSession,
      setSessionStatus,
      decidePermission,
    }),
    [
      classes,
      sessions,
      attendance,
      permissionRequests,
      members,
      loading,
      error,
      fromCache,
      isOffline,
      retry,
      createClass,
      updateClass,
      deleteClass,
      addMember,
      removeMember,
      createSession,
      updateSession,
      deleteSession,
      setSessionStatus,
      decidePermission,
    ],
  );

  return <AssistantDataContext.Provider value={value}>{children}</AssistantDataContext.Provider>;
}

export function useAssistantData(): AssistantDataContextValue {
  const ctx = useContext(AssistantDataContext);
  if (!ctx) {
    throw new Error('useAssistantData harus digunakan di dalam AssistantDataProvider.');
  }
  return ctx;
}

