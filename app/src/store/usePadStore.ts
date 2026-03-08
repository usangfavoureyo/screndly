import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PadSession } from '../types/pad';

interface PadStoreState {
  sessions: PadSession[];
  activeSessionId: string | null;
  setActiveSessionId: (sessionId: string | null) => void;
  saveSession: (session: PadSession) => void;
  getSessionById: (sessionId: string | null) => PadSession | undefined;
}

export const usePadStore = create<PadStoreState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,
      setActiveSessionId: (sessionId) => set({ activeSessionId: sessionId }),
      saveSession: (session) =>
        set((state) => {
          const existingIndex = state.sessions.findIndex((entry) => entry.id === session.id);
          if (existingIndex === -1) {
            return { sessions: [session, ...state.sessions], activeSessionId: session.id };
          }

          const nextSessions = [...state.sessions];
          nextSessions[existingIndex] = session;
          return { sessions: nextSessions, activeSessionId: session.id };
        }),
      getSessionById: (sessionId) => get().sessions.find((session) => session.id === sessionId),
    }),
    {
      name: 'screndly-pad-store',
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
      }),
    },
  ),
);
