import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BottomSheet } from '../ui/bottom-sheet';
import { ComposeOverview } from './ComposeOverview';
import { ComposeActivityPage } from './ComposeActivityPage';
import { ComposeEditorPage } from './ComposeEditorPage';

export type PostFlowView = 'overview' | 'activity' | 'editor';

interface PostFlowSheetProps {
  initialView?: PostFlowView;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

function buildInitialStack(view: PostFlowView): PostFlowView[] {
  if (view === 'activity') {
    return ['overview', 'activity'];
  }

  if (view === 'editor') {
    return ['overview', 'editor'];
  }

  return ['overview'];
}

export function PostFlowSheet({
  initialView = 'overview',
  onOpenChange,
  open,
}: PostFlowSheetProps) {
  const [stack, setStack] = useState<PostFlowView[]>(() => buildInitialStack(initialView));
  const closeRequestHandlerRef = useRef<(() => boolean) | null>(null);

  useEffect(() => {
    closeRequestHandlerRef.current = null;

    if (!open) {
      setStack(['overview']);
      return;
    }

    setStack(buildInitialStack(initialView));
  }, [initialView, open]);

  const currentView = stack[stack.length - 1] ?? 'overview';
  const previousView = stack.length > 1 ? stack[stack.length - 2] : null;

  const setCloseRequestHandler = useCallback((handler: (() => boolean) | null) => {
    closeRequestHandlerRef.current = handler;
  }, []);

  const navigateWithinSheet = useCallback((page: string) => {
    if (page === 'compose-editor') {
      setStack((currentStack) => (
        currentStack[currentStack.length - 1] === 'editor'
          ? currentStack
          : [...currentStack, 'editor']
      ));
      return;
    }

    if (page === 'compose-activity') {
      setStack((currentStack) => {
        const existingIndex = currentStack.lastIndexOf('activity');
        if (existingIndex >= 0) {
          return currentStack.slice(0, existingIndex + 1);
        }

        return ['overview', 'activity'];
      });
      return;
    }

    if (page === 'create') {
      setStack(['overview']);
    }
  }, []);

  const handleCloseRequest = useCallback(() => {
    const handledByView = closeRequestHandlerRef.current?.() ?? false;
    if (handledByView) {
      return;
    }

    if (stack.length > 1) {
      setStack((currentStack) => currentStack.slice(0, -1));
      return;
    }

    onOpenChange(false);
  }, [onOpenChange, stack.length]);

  const editorPreviousPage = useMemo(
    () => (previousView === 'activity' ? 'compose-activity' : 'create'),
    [previousView],
  );

  return (
    <BottomSheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          onOpenChange(true);
          return;
        }

        handleCloseRequest();
      }}
      heightMode="full"
      sheetId="post-flow-sheet"
    >
      <div className="min-h-full px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] sm:px-6">
        {currentView === 'activity' ? (
          <ComposeActivityPage
            onNavigate={navigateWithinSheet}
            previousPage="create"
          />
        ) : currentView === 'editor' ? (
          <ComposeEditorPage
            onNavigate={navigateWithinSheet}
            previousPage={editorPreviousPage}
            registerCloseRequestHandler={setCloseRequestHandler}
          />
        ) : (
          <ComposeOverview onNavigate={navigateWithinSheet} />
        )}
      </div>
    </BottomSheet>
  );
}
