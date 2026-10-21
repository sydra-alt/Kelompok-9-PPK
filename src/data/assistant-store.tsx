import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';

import { initialAttendance, initialSessions, type AssistantAttendance, type AssistantSession, type SessionStatus } from './assistant-sessions';

type AssistantStoreValue = {
  sessions: AssistantSession[];
  attendance: AssistantAttendance[];
  setSessionStatus: (sessionId: string, status: SessionStatus) => void;
};

const AssistantStore = createContext<AssistantStoreValue | null>(null);

export function AssistantStoreProvider({ children }: PropsWithChildren) {
  const [sessions, setSessions] = useState(initialSessions);
  const [attendance] = useState(initialAttendance);
  const value = useMemo(
    () => ({
      sessions,
      attendance,
      setSessionStatus: (sessionId: string, status: SessionStatus) => {
        setSessions((current) => current.map((session) =>
          session.id === sessionId ? { ...session, status } : session,
        ));
      },
    }),
    [sessions, attendance],
  );

  return <AssistantStore.Provider value={value}>{children}</AssistantStore.Provider>;
}

export function useAssistantStore() {
  const value = useContext(AssistantStore);
  if (!value) throw new Error('useAssistantStore harus dipakai di dalam AssistantStoreProvider');
  return value;
}
