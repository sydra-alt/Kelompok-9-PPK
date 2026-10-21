import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';

import { initialAssistantAttendance, initialAssistantSessions } from '@/data/assistant-sessions';
import type { AttendanceRecord, PracticeSession, SessionStatus } from '@/types';

interface AssistantStoreValue {
  sessions: PracticeSession[];
  attendance: AttendanceRecord[];
  setSessionStatus: (sessionId: string, status: SessionStatus) => void;
}

const AssistantStore = createContext<AssistantStoreValue | null>(null);

/** State sesi khusus demonstrasi alur asisten dan berbagi antarrute asisten. */
export function AssistantStoreProvider({ children }: PropsWithChildren) {
  const [sessions, setSessions] = useState(initialAssistantSessions);
  const [attendance] = useState(initialAssistantAttendance);

  const value = useMemo<AssistantStoreValue>(
    () => ({
      sessions,
      attendance,
      setSessionStatus: (sessionId, status) => {
        setSessions((current) =>
          current.map((session) =>
            session.id === sessionId ? { ...session, status } : session,
          ),
        );
      },
    }),
    [sessions, attendance],
  );

  return <AssistantStore.Provider value={value}>{children}</AssistantStore.Provider>;
}

export function useAssistantStore() {
  const value = useContext(AssistantStore);
  if (!value) {
    throw new Error('useAssistantStore harus dipakai di dalam AssistantStoreProvider');
  }
  return value;
}
