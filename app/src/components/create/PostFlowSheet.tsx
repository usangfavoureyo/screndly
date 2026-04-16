import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BottomSheet } from '../ui/bottom-sheet';
import { Sheet, SheetContent } from '../ui/sheet';
import { ComposeOverview } from './ComposeOverview';
import { ComposeActivityPage } from './ComposeActivityPage';
import { ComposeEditorPage } from './ComposeEditorPage';

export type PostFlowView = 'overview' | 'activity' | 'editor';

interface PostFlowSheetProps {
  initialView?: PostFlowView;
  isDesktopViewport?: boolean;
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
  isDesktopViewport = false,
  onOpenChange,
  open,
}: PostFlowSheetProps) {
  const [stack, setStack] = useState<PostFlowView[]>(() => buildInitialStack(initialView));
  const closeRequestHandlerRef = useRef<(() => boolean) | null>(null);
  const internalNavigationLockUntilRef = useRef(0);
  const wasOpenRef = useRef(open);

  useLayoutEffect(() => {
    closeRequestHandlerRef.current = null;

    if (!open) {
      setStack(['overview']);
      wasOpenRef.current = false;
      return;
    }

    if (!wasOpenRef.current) {
      setStack(buildInitialStack(initialView));
      wasOpenRef.current = true;
    }
  }, [initialView, open]);

  const currentView = stack[stack.length - 1] ?? 'overview';
  const previousView = stack.length > 1 ? stack[stack.length - 2] : null;

  const setCloseRequestHandler = useCallback((handler: (() => boolean) | null) => {
    closeRequestHandlerRef.current = handler;
  }, []);

  const armInternalNavigationLock = useCallback(() => {
    internalNavigationLockUntilRef.current = Date.now() + 450;
  }, []);

  const navigateWithinSheet = useCallback((page: string, fromPage?: string) => {
    if (page === 'compose-editor') {
      armInternalNavigationLock();
      setStack((currentStack) => (
        currentStack[currentStack.length - 1] === 'editor'
          ? currentStack
          : [...currentStack, 'editor']
      ));
      return;
    }

    if (page === 'compose-activity') {
      armInternalNavigationLock();
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
      if (fromPage === 'compose-activity') {
        setStack(['overview', 'activity']);
        return;
      }

      setStack(['overview']);
    }
  }, [armInternalNavigationLock]);



  const editorPreviousPage = useMemo(
    () => (previousView === 'activity' ? 'compose-activity' : 'create'),
    [previousView],
  );

  const requestClose = useCallback(() => {
    const handled = closeRequestHandlerRef.current?.() ?? false;
    if (!handled) {
      onOpenChange(false);
    }
  }, [onOpenChange]);

  const handleSheetBackRequest = useCallback(() => {
    if (Date.now() < internalNavigationLockUntilRef.current) {
      return true;
    }

    if (stack.length <= 1) {
      return false;
    }

    const handled = closeRequestHandlerRef.current?.() ?? false;
    if (handled) {
      return true;
    }

    setStack((currentStack) => (
      currentStack.length > 1 ? currentStack.slice(0, -1) : currentStack
    ));
    return true;
  }, [stack.length]);

  const handleSheetOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }

    const handledBackNavigation = handleSheetBackRequest();
    if (handledBackNavigation) {
      return;
    }

    onOpenChange(false);
  }, [handleSheetBackRequest, onOpenChange]);

  const flowContent = currentView === 'activity' ? (
    <ComposeActivityPage
      isCompactLayout={isDesktopViewport}
      onNavigate={navigateWithinSheet}
      previousPage="create"
    />
  ) : currentView === 'editor' ? (
    <ComposeEditorPage
      isCompactLayout={isDesktopViewport}
      onNavigate={navigateWithinSheet}
      previousPage={editorPreviousPage}
      registerCloseRequestHandler={setCloseRequestHandler}
    />
  ) : (
    <ComposeOverview isCompactLayout={isDesktopViewport} onNavigate={navigateWithinSheet} />
  );

  if (isDesktopViewport) {
    return (
      <Sheet
        open={open}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            onOpenChange(true);
            return;
          }

          const handledBackNavigation = handleSheetBackRequest();
          if (handledBackNavigation) {
            return;
          }

          requestClose();
        }}
      >
        <SheetContent
          side="right"
          className="group/post-flow w-full max-w-[min(100vw,32rem)] border-l border-gray-200 bg-white p-0 dark:border-[#222222] dark:bg-[#050505] sm:max-w-[32rem]"
          showCloseButton={false}
        >
          <div className="relative flex h-full min-h-0 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              {flowContent}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={handleSheetOpenChange}
      onBackRequest={handleSheetBackRequest}
      heightMode="full"
      sheetId="post-flow-sheet"
    >
      <div className="h-full min-h-0 overflow-x-hidden bg-white px-4 pb-4 dark:bg-[#000000] sm:px-6">
        {flowContent}
      </div>
    </BottomSheet>
  );
}
