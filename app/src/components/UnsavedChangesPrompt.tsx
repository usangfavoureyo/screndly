import { haptics } from '../utils/haptics';
import { Button } from './ui/button';
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetDescription,
  BottomSheetFooter,
  BottomSheetHeader,
  BottomSheetTitle,
} from './ui/bottom-sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { useIsMobile } from './ui/use-mobile';

interface UnsavedChangesPromptProps {
  cancelLabel?: string;
  confirmLabel?: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title?: string;
}

export function UnsavedChangesPrompt({
  cancelLabel = 'Keep Editing',
  confirmLabel = 'Discard Changes',
  description,
  onCancel,
  onConfirm,
  onOpenChange,
  open,
  title = 'Discard changes?',
}: UnsavedChangesPromptProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <BottomSheet open={open} onOpenChange={onOpenChange}>
        <BottomSheetHeader>
          <BottomSheetTitle>{title}</BottomSheetTitle>
          <BottomSheetDescription>{description}</BottomSheetDescription>
        </BottomSheetHeader>
        <BottomSheetBody>
          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
            Your unsaved input will be lost if you leave now.
          </p>
        </BottomSheetBody>
        <BottomSheetFooter>
          <div className="flex w-full gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                haptics.light();
                onCancel();
              }}
            >
              {cancelLabel}
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                haptics.medium();
                onConfirm();
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </BottomSheetFooter>
      </BottomSheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
          Your unsaved input will be lost if you leave now.
        </p>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              haptics.light();
              onCancel();
            }}
          >
            {cancelLabel}
          </Button>
          <Button
            onClick={() => {
              haptics.medium();
              onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
