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
  getPermissionRequestById,
  getSessionById,
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
  type UpdateSessionInput,
} from '@/services/assistant-data-service';
import { getErrorMessage } from '@/services/errors';
import {
  createLab as serviceCreateLab,
  deleteLab as serviceDeleteLab,
  subscribeAllLabs,
  updateLab as serviceUpdateLab,
  type LabInput,
} from '@/services/lab-service';
import {
  hasScheduleChanged,
  notifyPermissionDecision,
  notifyScheduleChanged,
  notifySessionOpened,
  type NotificationDispatchResult,
} from '@/services/notification-dispatch-service';
import type {
  AttendanceRecord,
  ClassMembership,
  Lab,
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
 * - Laboratorium (`labs`)
 * - Sesi pertemuan (`sessions`)
 * - Rekap presensi (`attendance`)
 * - Pengajuan izin praktikan (`permissionRequests`)
 */

interface AssistantDataContextValue {
  classes: PracticeClass[];
  labs: Lab[];
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
  // CRUD Laboratorium
  createLab: (input: LabInput) => Promise<string>;
  updateLab: (labId: string, input: LabInput) => Promise<void>;
  deleteLab: (labId: string) => Promise<void>;
  // CRUD Peserta
  addMember: (input: AddMemberInput) => Promise<string>;
  removeMember: (memberId: string) => Promise<void>;
  // CRUD Sesi & Status
  createSession: (input: CreateSessionInput) => Promise<string>;
  updateSession: (
    sessionId: string,
    updates: UpdateSessionInput,
  ) => Promise<NotificationDispatchResult | null>;
  deleteSession: (sessionId: string) => Promise<void>;
  setSessionStatus: (
    sessionId: string,
    status: SessionStatus,
  ) => Promise<NotificationDispatchResult | null>;
  // Keputusan Izin
  decidePermission: (
    requestId: string,
    decision: PermissionStatus,
    note?: string,
  ) => Promise<NotificationDispatchResult | null>;
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
  const [labsSnap, setLabsSnap] = useState<KeyedData<Lab[]> | null>(null);
  const [membersSnap, setMembersSnap] = useState<KeyedData<ClassMembership[]> | null>(null);
  const [sessionsSnap, setSessionsSnap] = useState<KeyedData<PracticeSession[]> | null>(null);
  const [attendanceSnap, setAttendanceSnap] = useState<KeyedData<AttendanceRecord[]> | null>(null);
  const [permissionsSnap, setPermissionsSnap] = useState<KeyedData<PermissionRequest[]> | null>(null);

  // 1. Gabungkan kelas milik asisten dengan kelas legacy yang belum memiliki assistantIds.
  useEffect(() => {
    if (!assistantUid || !assistantScopeKey) return undefined;

    const handleError = (err: unknown) => {
      setErrorState({
        key: assistantScopeKey,
        message: getErrorMessage(err, 'Gagal memuat kelas yang diampu dari server.'),
      });
    };

    let assignedClasses: PracticeClass[] = [];
    let legacyClasses: PracticeClass[] = [];

    const publishClasses = (fromCache: boolean) => {
      const classesById = new Map<string, PracticeClass>();
      for (const item of legacyClasses) classesById.set(item.id, item);
      for (const item of assignedClasses) classesById.set(item.id, item);
      const data = [...classesById.values()].sort((a, b) => a.name.localeCompare(b.name));
      setClassesSnap({ key: assistantScopeKey, data, fromCache });
    };

    const unsubAll = subscribeAllClasses(
      (data, meta) => {
        // Pertahankan dokumen lama tanpa assistantIds saat kelas baru dibuat.
        legacyClasses = data.filter((item) => item.assistantIds.length === 0);
        publishClasses(meta.fromCache);
      },
      handleError,
    );
    const unsubAssigned = subscribeAssistantClasses(
      assistantUid,
      (data, meta) => {
        assignedClasses = data;
        publishClasses(meta.fromCache);
      },
      handleError,
    );

    return () => {
      unsubAll();
      unsubAssigned();
    };
  }, [assistantUid, assistantScopeKey]);

  // 1b. Berlangganan daftar laboratorium secara real-time (Sprint 3)
  useEffect(() => {
    if (!assistantUid || !assistantScopeKey) return undefined;

    return subscribeAllLabs(
      (data, meta) => {
        setLabsSnap({ key: assistantScopeKey, data, fromCache: meta.fromCache });
      },
      (err) => {
        setErrorState({
          key: assistantScopeKey,
          message: getErrorMessage(err, 'Gagal memuat data laboratorium dari server.'),
        });
      },
    );
  }, [assistantUid, assistantScopeKey]);

  const classesLoaded = Boolean(assistantScopeKey && classesSnap?.key === assistantScopeKey);
  const labsLoaded = Boolean(assistantScopeKey && labsSnap?.key === assistantScopeKey);
  const classes = useMemo(
    () => (classesLoaded && classesSnap ? classesSnap.data : []),
    [classesLoaded, classesSnap],
  );
  const labs = useMemo(
    () => (labsLoaded && labsSnap ? labsSnap.data : []),
    [labsLoaded, labsSnap],
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
      (labsLoaded && labsSnap?.fromCache) ||
      (sessionsLoaded && sessionsSnap?.fromCache) ||
      (attendanceLoaded && attendanceSnap?.fromCache) ||
      (permissionsLoaded && permissionsSnap?.fromCache),
  );

  const loading = Boolean(
    assistantScopeKey &&
      !error &&
      (!classesLoaded ||
        !labsLoaded ||
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

  const createLab = useCallback(async (input: LabInput) => {
    return serviceCreateLab(input);
  }, []);

  const updateLab = useCallback(async (labId: string, input: LabInput) => {
    return serviceUpdateLab(labId, input);
  }, []);

  const deleteLab = useCallback(async (labId: string) => {
    return serviceDeleteLab(labId);
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
    async (
      sessionId: string,
      updates: UpdateSessionInput,
    ): Promise<NotificationDispatchResult | null> => {
      const previous = sessions.find((item) => item.id === sessionId);
      await serviceUpdateSession(sessionId, updates);

      if (!hasScheduleChanged(previous, updates)) {
        return null;
      }

      try {
        const targetSession = previous
          ? { ...previous, ...updates }
          : await getSessionById(sessionId);
        if (!targetSession) {
          return {
            status: 'failed',
            recipientCount: 0,
            tokenCount: 0,
            sentCount: 0,
            failedCount: 0,
            message: 'Detail sesi terbaru tidak ditemukan untuk pengiriman notifikasi.',
          };
        }
        return await notifyScheduleChanged(targetSession);
      } catch (err) {
        return {
          status: 'failed',
          recipientCount: 0,
          tokenCount: 0,
          sentCount: 0,
          failedCount: 0,
          message: getErrorMessage(err, 'Pengiriman notifikasi perubahan jadwal gagal.'),
        };
      }
    },
    [sessions],
  );

  const deleteSession = useCallback(async (sessionId: string) => {
    return serviceDeleteSession(sessionId);
  }, []);

  const setSessionStatus = useCallback(
    async (
      sessionId: string,
      nextStatus: SessionStatus,
    ): Promise<NotificationDispatchResult | null> => {
      if (nextStatus === 'scheduled') {
        throw new Error('Status tidak dapat dikembalikan ke scheduled.');
      }
      const existing = sessions.find((item) => item.id === sessionId);
      await serviceUpdateSessionStatus(sessionId, nextStatus);

      if (nextStatus !== 'open') {
        return null;
      }

      try {
        const targetSession = existing ?? (await getSessionById(sessionId));
        if (!targetSession) {
          return {
            status: 'failed',
            recipientCount: 0,
            tokenCount: 0,
            sentCount: 0,
            failedCount: 0,
            message: 'Detail sesi tidak ditemukan untuk pengiriman notifikasi.',
          };
        }
        return await notifySessionOpened({ ...targetSession, status: 'open' });
      } catch (err) {
        return {
          status: 'failed',
          recipientCount: 0,
          tokenCount: 0,
          sentCount: 0,
          failedCount: 0,
          message: getErrorMessage(err, 'Pengiriman notifikasi pembukaan sesi gagal.'),
        };
      }
    },
    [sessions],
  );

  const decidePermission = useCallback(
    async (
      requestId: string,
      decision: PermissionStatus,
      note?: string,
    ): Promise<NotificationDispatchResult | null> => {
      if (!profile) throw new Error('Profil asisten tidak ditemukan.');
      const existing = permissionRequests.find((item) => item.id === requestId);
      await serviceDecidePermission(requestId, decision, profile, note);

      if (decision !== 'approved' && decision !== 'rejected') {
        return null;
      }

      try {
        const targetRequest = existing ?? (await getPermissionRequestById(requestId));
        if (!targetRequest) {
          return {
            status: 'failed',
            recipientCount: 0,
            tokenCount: 0,
            sentCount: 0,
            failedCount: 0,
            message: 'Data pengajuan izin tidak ditemukan untuk pengiriman notifikasi.',
          };
        }
        return await notifyPermissionDecision(targetRequest, decision, note);
      } catch (err) {
        return {
          status: 'failed',
          recipientCount: 0,
          tokenCount: 0,
          sentCount: 0,
          failedCount: 0,
          message: getErrorMessage(err, 'Pengiriman notifikasi keputusan izin gagal.'),
        };
      }
    },
    [profile, permissionRequests],
  );

  const value = useMemo<AssistantDataContextValue>(
    () => ({
      classes,
      labs,
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
      createLab,
      updateLab,
      deleteLab,
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
      labs,
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
      createLab,
      updateLab,
      deleteLab,
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

