"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import { useBackNavigation } from "../../contexts/BackNavigationContext";
import { getTransientHistoryPayload, useTransientHistoryState } from "../../hooks/useTransientHistoryState";

import { cn } from "./utils";

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50 pointer-events-none",
        className,
      )}
      {...props}
    />
  );
});
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

function DialogContent({
  className,
  children,
  hideCloseButton,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  hideCloseButton?: boolean;
}) {
  // Generate unique ID for back navigation context
  const uniqueId = React.useMemo(() => `dialog-${Date.now()}-${Math.random().toString(36).slice(2)}`, []);

  // We need to access the close handler. Since Radix controls state, we can't directly close it unless we have access to setOpen.
  // However, Radix `DialogContent` is usually used within a `Dialog` which has `onOpenChange`.
  // BUT we don't have access to `onOpenChange` here inside `DialogContent` unless passed or via context (which is internal to Radix).
  // Strategy: We will use a ref to find the close button and click it? No, that's hacky.
  // Better: Users of `Dialog` should handle open state.
  // ALTERNATIVE: Use `useBackNavigation` to just REGISTER presence.
  // BUT we want ESC to close it.
  // Radix handles ESC by default. We disabled it? No, not yet.
  // If we let Radix handle ESC, `BackNavigationContext` won't know it closed, and might block other things.
  // WAIT: If Radix handles ESC, it closes the modal. The component unmounts. `BackNavigationContext` unregister happens.
  // So we just need to BLOCK `BackNavigationContext` from handling ESC if Radix handles it?
  // OR we let `BackNavigationContext` handle ESC and trigger the close.
  // To trigger close from Context, we need a handler.
  // Since we can't easily get the handler here without changing API, let's assume Radix handles standard ESC.
  // AND we just register to prevent "Back" from navigating away? 
  // YES. The user requirement is "ESC... Close active modal".
  // If Radix does it, great. We just need to ensure `BackNavigationContext` doesn't INTERFERE or think it needs to close something else.
  // Actually, if we use `KeyboardContext` -> `BackNavigationContext.handleBackPress`, it returns TRUE if modals exist.
  // If we return TRUE, we stop propagation.
  // We need `BackNavigationContext` to actually close the modal.
  // If we can't get the close handler, we can't use `BackNavigationContext` to close it.

  // FIX: We need a way to close the dialog from the context.
  // Radix `DialogContent` has an `onEscapeKeyDown` prop.
  // If we use that, we are relying on Radix focus trap.

  // Let's try to simulate a click on the Close button as a fallback if we can't get context?
  // Or simpler: Just rely on Radix for ESC handling for DIALOGS, but ensure `KeyboardContext` ignores ESC if a Dialog is open?
  // But `KeyboardContext` is global. It WILL catch ESC.
  // If Radix also catches ESC, we have double handling.

  // PROPOSED SOLUTION:
  // 1. We register with `BackNavigationContext` only to "Block" other actions.
  // 2. We allow Radix to handle ESC natively.
  // 3. `KeyboardContext` sees `activeModals.length > 0` -> calls `backNav.handleBackPress`.
  // 4. `handleBackPress` tries to close it. Use a ref to the `DialogPrimitive.Close` button or similar? 
  // Or just accept that for Dialogs, we might need to pass `onOpenChange` to `DialogContent` if we want external control.
  // Current `Dialog` usage in app implies standard Radix usage.

  // For now, let's just register it so we know it's there.
  // We will assume Radix handles ESC keydown *before* our window listener?
  // Radix uses `keydown` on document/window too.

  // Let's stick to the plan: Register it. 
  // We will pass a dummy close handler or try to find a way.
  // Actually, standard `Dialog` from shadcn usually doesn't pass `onOpenChange` to Content.
  // Let's rely on Radix ESC behavior and just register for "Back" button safety on mobile?
  // But User asked for DESKTOP behavior.
  // If Radix handles ESC, it works on Desktop.
  // The issue is priority: If a BottomSheet IS ALSO OPEN.
  // Modals are usually on top.
  // If Modal is open, BottomSheet shouldn't close.
  // Radix handles this via pointer-events/focus trap usually.

  // Let's try to just ADD `useBackNavigation` registration for state tracking.
  // If we don't provide a close handler, `closeTopModal` won't work.
  // We'll leave the Close Handler empty for now and let Radix do its thing?
  // No, `handleBackPress` returns true if activeModals > 0. It tries to close. If it can't, it returns true anyway (blocks propagation).
  // So user presses ESC -> `KeyboardContext` catches -> `handleBackPress` -> sees modal -> returns true.
  // Result: Nothing happens (if we don't have a handler). Radix might NOT get the event if we stop propagation?
  // `KeyboardContext` stops propagation if `handled` is true.
  // So we MUST have a close handler.

  // To get a close handler:
  // We can use `onInteractOutside` or `onEscapeKeyDown` to trigger our own logic? No.
  // We need to trigger the close.
  // The only way to close a Radix dialog is by changing the `open` state controlling it.
  // Since we don't have that here... users of `<Dialog>` usually do `<Dialog open={isOpen} onOpenChange={setIsOpen}>`.
  // Maybe we don't touch Dialog.tsx for now and assume Radix handles priority via z-index/focus trap?
  // But `KeyboardContext` listens on Window. Radix listens on Window.
  // If `KeyboardContext` captures first and stops prop, Radix dies.
  // If `KeyboardContext` captures first and doesn't stop prop, Radix works.

  // Modified Plan for Dialogs:
  // Do NOT registers with `BackNavigationContext` inside `DialogContent` if we can't close it.
  // Instead, rely on Radix's native ESC handling.
  // BUT `KeyboardContext` checks `handleBackPress`.
  // `handleBackPress` checks `activeModals`.
  // If we DON'T register, `activeModals` is empty.
  // `activeBottomSheets` might be > 0.
  // ESC -> `BackNavigationContext` sees 0 modals, >0 sheets. Closes Sheet.
  // Result: Modal stays open, Sheet below it closes. UI Glitch.

  // So we MUST register.
  // And we MUST be able to close it.

  // We will add `onOpenChange` prop to `DialogContent`?
  // That requires changing all call sites... messy.

  // Alternative: Reference a hidden close button and click it.
  // Radix `DialogContent` usually contains a `DialogClose` or we can inject one.
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);

  const { registerModalWithCloseHandler, unregisterModal } = useBackNavigation();
  useTransientHistoryState(true, uniqueId, 'dialog');

  React.useEffect(() => {
    const id = uniqueId;
    registerModalWithCloseHandler(id, () => {
      closeButtonRef.current?.click();
    });
    return () => unregisterModal(id);
  }, [uniqueId, registerModalWithCloseHandler, unregisterModal]);

  React.useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const activeTransientId = getTransientHistoryPayload(
        (event.state as Record<string, unknown> | null) ?? null,
      )?.id;

      if (activeTransientId === uniqueId) {
        return;
      }

      closeButtonRef.current?.click();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [uniqueId]);

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "bg-white dark:bg-[#000000] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg pointer-events-auto",
          className,
        )}
        {...props}
      >
        {children}
        {!hideCloseButton && (
          <DialogPrimitive.Close
            ref={closeButtonRef}
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[26px] [&_svg]:stroke-1"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
        {/* Fallback hidden close button if hideCloseButton is true */}
        {hideCloseButton && (
          <DialogPrimitive.Close ref={closeButtonRef} className="hidden" />
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
