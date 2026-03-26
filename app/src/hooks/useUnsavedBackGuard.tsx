import { useCallback, useRef, useState } from 'react';
import { UnsavedChangesPrompt } from '../components/UnsavedChangesPrompt';

const PROMPT_OPEN_SETTLE_WINDOW_MS = 350;

interface UseUnsavedBackGuardOptions {
  cancelLabel?: string;
  confirmLabel?: string;
  description: string;
  isDirty: boolean;
  title?: string;
}

export function useUnsavedBackGuard({
  cancelLabel,
  confirmLabel,
  description,
  isDirty,
  title,
}: UseUnsavedBackGuardOptions) {
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const promptOpenedAtRef = useRef(0);

  const cancelDiscard = useCallback(() => {
    pendingActionRef.current = null;
    promptOpenedAtRef.current = 0;
    setIsPromptOpen(false);
  }, []);

  const confirmDiscard = useCallback(() => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    promptOpenedAtRef.current = 0;
    setIsPromptOpen(false);
    action?.();
  }, []);

  const guardAction = useCallback((action: () => void) => {
    if (!isDirty) {
      action();
      return true;
    }

    pendingActionRef.current = action;
    promptOpenedAtRef.current = Date.now();
    setIsPromptOpen(true);
    return true;
  }, [isDirty]);

  const prompt = (
    <UnsavedChangesPrompt
      open={isPromptOpen}
      onOpenChange={(open) => {
        if (open) {
          promptOpenedAtRef.current = Date.now();
          setIsPromptOpen(true);
          return;
        }

        if (Date.now() - promptOpenedAtRef.current < PROMPT_OPEN_SETTLE_WINDOW_MS) {
          return;
        }

        cancelDiscard();
      }}
      onCancel={cancelDiscard}
      onConfirm={confirmDiscard}
      title={title}
      description={description}
      cancelLabel={cancelLabel}
      confirmLabel={confirmLabel}
    />
  );

  return {
    cancelDiscard,
    confirmDiscard,
    guardAction,
    isPromptOpen,
    prompt,
  };
}
