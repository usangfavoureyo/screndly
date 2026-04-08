import { useCallback, useMemo, useState } from 'react';
import { filterAcceptedFiles } from '../utils/fileAccept';

type DesktopFileDropOptions = {
  onFiles: (files: File[]) => void;
  accept?: string;
  isEnabled?: boolean;
};

function isDesktopPointer() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(pointer: fine)').matches;
}

export function useDesktopFileDrop({ onFiles, accept, isEnabled = true }: DesktopFileDropOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const enabled = useMemo(() => isEnabled && isDesktopPointer(), [isEnabled]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    if (!enabled) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsDragging(true);
  }, [enabled]);

  const handleDragEnter = useCallback((event: React.DragEvent) => {
    if (!enabled) return;
    event.preventDefault();
    setIsDragging(true);
  }, [enabled]);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    if (!enabled) return;
    event.preventDefault();
    setIsDragging(false);
  }, [enabled]);

  const handleDrop = useCallback((event: React.DragEvent) => {
    if (!enabled) return;
    event.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(event.dataTransfer.files ?? []);
    if (!droppedFiles.length) return;
    const acceptedFiles = filterAcceptedFiles(droppedFiles, accept);
    if (!acceptedFiles.length) return;
    onFiles(acceptedFiles);
  }, [accept, enabled, onFiles]);

  return {
    isDragging,
    bind: {
      onDragOver: handleDragOver,
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    },
  };
}
