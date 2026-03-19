import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BottomSheet } from '../ui/bottom-sheet';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
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

  const viewTitle = currentView === 'activity'
    ? 'Post activity'
    : currentView === 'editor'
      ? 'Edit post'
      : 'Posts';

  const flowContent = currentView === 'activity' ? (
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

          requestClose();
        }}
      >
        <SheetContent
          side="right"
          className="group/post-flow w-full max-w-[min(100vw,32rem)] border-l border-gray-200 bg-white p-0 dark:border-[#222222] dark:bg-[#050505] sm:max-w-[32rem]"
          closeButtonClassName="top-4 right-4 opacity-30 hover:opacity-100 focus:opacity-100 group-hover/post-flow:opacity-85 group-focus-within/post-flow:opacity-85"
        >
          <div className="flex h-full min-h-0 flex-col">
            <SheetHeader className="border-b border-gray-200 px-5 py-4 pr-14 dark:border-[#222222]">
              <SheetTitle className="text-base font-semibold text-gray-900 dark:text-white">
                {viewTitle}
              </SheetTitle>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
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
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          onOpenChange(true);
          return;
        }

        // Swipe-dismiss always fully closes the sheet
        onOpenChange(false);
      }}
      heightMode="full"
      sheetId="post-flow-sheet"
    >
      <div className="min-h-full px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] sm:px-6">
        {flowContent}
      </div>
    </BottomSheet>
  );
}
