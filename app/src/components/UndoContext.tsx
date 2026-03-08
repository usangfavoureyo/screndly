import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

interface UndoItem {
  id: string;
  itemName: string;
  onUndo: () => void | Promise<void>;
  onConfirm?: () => void | Promise<void>;
}

interface UndoContextType {
  showUndo: (item: UndoItem) => void;
  hideUndo: (skipConfirm?: boolean) => void;
  currentItem: UndoItem | null;
}

const UndoContext = createContext<UndoContextType | undefined>(undefined);

export function UndoProvider({ children }: { children: React.ReactNode }) {
  const [currentItem, setCurrentItem] = useState<UndoItem | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const hideUndo = useCallback((skipConfirm = false) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Execute the confirm callback if it exists
    if (!skipConfirm && currentItem?.onConfirm) {
      void currentItem.onConfirm();
    }

    setCurrentItem(null);
  }, [currentItem]);

  const showUndo = useCallback((item: UndoItem) => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setCurrentItem(item);

    // Auto-hide after 5 seconds
    timeoutRef.current = setTimeout(() => {
      hideUndo();
    }, 5000);
  }, [hideUndo]);

  return (
    <UndoContext.Provider value={{ showUndo, hideUndo, currentItem }}>
      {children}
    </UndoContext.Provider>
  );
}

export function useUndo() {
  const context = useContext(UndoContext);
  if (context === undefined) {
    throw new Error('useUndo must be used within an UndoProvider');
  }
  return context;
}
