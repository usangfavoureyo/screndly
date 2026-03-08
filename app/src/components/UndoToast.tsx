import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useUndo } from './UndoContext';
import { haptics } from '../utils/haptics';

export function UndoToast() {
  const { currentItem, hideUndo } = useUndo();

  if (!currentItem) return null;

  const handleUndo = () => {
    haptics.medium();
    void currentItem.onUndo();
    hideUndo(true);
  };

  const toastContent = (
    <div
      // Critical: Using inline styles for positioning/z-index as proven by debug step
      style={{
        position: 'fixed',
        bottom: '85px', // Sit above bottom nav (approx 60-80px)
        left: '16px',
        right: '16px',
        zIndex: 99999, // Super high z-index
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none', // Allow clicks through empty space
        transform: 'translateZ(0)', // Force GPU layer
      }}
      role="alert"
      aria-live="polite"
    >
      <style>{`
        @keyframes undoSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      {/* Inner Card - Polished Design using Tailwind + Safe Keyframe Animation */}
      <div
        style={{ animation: 'undoSlideUp 0.35s cubic-bezier(0.21, 1.02, 0.32, 1) forwards' }}
        className="w-full max-w-md bg-white dark:bg-[#000000] border border-gray-300 dark:border-[#333333] rounded-lg shadow-2xl px-4 py-3 flex items-center justify-between ring-1 ring-black/5 pointer-events-auto"
      >
        <span className="text-sm font-medium text-gray-900 dark:text-white truncate pr-4">
          {currentItem.itemName}
        </span>
        <button
          onClick={handleUndo}
          className="ml-auto text-sm font-bold text-[#ec1e24] hover:text-[#d01a20] active:text-[#b0161b] transition-colors p-1.5 -mr-1.5 rounded-md hover:bg-red-50 dark:hover:bg-[#ec1e24]/10"
        >
          Undo
        </button>
      </div>
    </div>
  );

  return createPortal(toastContent, document.body);
}
