import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PadMessage, PadSession } from '../types/pad';

interface PadStoreState {
  sessions: PadSession[];
  activeSessionId: string | null;
  setActiveSessionId: (sessionId: string | null) => void;
  createSession: (session: PadSession) => void;
  saveSession: (session: PadSession) => void;
  deleteSession: (sessionId: string) => void;
  renameSession: (sessionId: string, title: string) => void;
  togglePinned: (sessionId: string) => void;
  appendMessage: (sessionId: string, message: PadMessage) => void;
  updateSystemPrompt: (sessionId: string, systemPrompt: string) => void;
  getSessionById: (sessionId: string | null) => PadSession | undefined;
}

function normalizeSession(session: PadSession): PadSession {
  const normalizedOutputs = session.outputs ?? [];
  const normalizedMessages =
    session.messages?.length
      ? session.messages
      : session.latestOutput
        ? [{ id: `legacy-output-${session.id}`, role: 'assistant', content: session.latestOutput, createdAt: session.updatedAt }]
        : [];

  const latestOutput = normalizedMessages.filter((message) => message.role === 'assistant').at(0)?.content ?? session.latestOutput ?? '';

  return {
    ...session,
    systemPrompt: session.systemPrompt ?? session.context ?? session.brief ?? '',
    pinned: session.pinned ?? false,
    messages: normalizedMessages,
    latestOutput,
    outputs: normalizedOutputs,
  };
}

function upsertSession(sessions: PadSession[], session: PadSession) {
  const normalized = normalizeSession(session);
  const existingIndex = sessions.findIndex((entry) => entry.id === normalized.id);
  if (existingIndex === -1) {
    return [normalized, ...sessions];
  }

  const nextSessions = [...sessions];
  nextSessions[existingIndex] = normalized;
  return nextSessions;
}

export const usePadStore = create<PadStoreState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,
      setActiveSessionId: (sessionId) => set({ activeSessionId: sessionId }),
      createSession: (session) =>
        set((state) => ({
          sessions: upsertSession(state.sessions, session),
          activeSessionId: session.id,
        })),
      saveSession: (session) =>
        set((state) => ({
          sessions: upsertSession(state.sessions, session),
          activeSessionId: session.id,
        })),
      deleteSession: (sessionId) =>
        set((state) => {
          const remaining = state.sessions.filter((session) => session.id !== sessionId);
          return {
            sessions: remaining,
            activeSessionId: state.activeSessionId === sessionId ? remaining[0]?.id ?? null : state.activeSessionId,
          };
        }),
      renameSession: (sessionId, title) =>
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId ? { ...session, title, updatedAt: new Date().toISOString() } : session,
          ),
        })),
      togglePinned: (sessionId) =>
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId ? { ...session, pinned: !session.pinned, updatedAt: new Date().toISOString() } : session,
          ),
        })),
      appendMessage: (sessionId, message) =>
        set((state) => ({
          sessions: state.sessions.map((session) => {
            if (session.id !== sessionId) return session;

            const messages = [...session.messages, message];
            const latestOutput = [...messages].reverse().find((entry) => entry.role === 'assistant')?.content ?? session.latestOutput;
            const outputs =
              message.role === 'assistant'
                ? [{ id: `output-${message.id}`, content: message.content, createdAt: message.createdAt }, ...session.outputs]
                : session.outputs;

            return {
              ...session,
              messages,
              latestOutput,
              outputs,
              updatedAt: message.createdAt,
            };
          }),
        })),
      updateSystemPrompt: (sessionId, systemPrompt) =>
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId ? { ...session, systemPrompt, updatedAt: new Date().toISOString() } : session,
          ),
        })),
      getSessionById: (sessionId) => get().sessions.find((session) => session.id === sessionId),
    }),
    {
      name: 'screndly-pad-store',
      partialize: (state) => ({
        sessions: state.sessions.map(normalizeSession),
        activeSessionId: state.activeSessionId,
      }),
      merge: (persistedState, currentState) => {
        const typedPersistedState = persistedState as Partial<PadStoreState> | undefined;
        return {
          ...currentState,
          ...typedPersistedState,
          sessions: (typedPersistedState?.sessions ?? currentState.sessions).map(normalizeSession),
        };
      },
    },
  ),
);
