import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useBackNavigation } from './BackNavigationContext';

interface KeyboardContextType {
    isInputFocused: boolean;
    registerShortcut: (key: string, handler: () => void) => void;
    unregisterShortcut: (key: string) => void;
}

const KeyboardContext = createContext<KeyboardContextType | undefined>(undefined);

export function KeyboardProvider({ children }: { children: React.ReactNode }) {
    const { handleBackPress } = useBackNavigation();
    const [isInputFocused, setIsInputFocused] = useState(false);
    const [shortcuts] = useState(new Map<string, () => void>());

    // Helper to check if an element is an input
    const checkInputFocus = useCallback(() => {
        const active = document.activeElement;
        const isInput = active && (
            active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            active.getAttribute('contenteditable') === 'true'
        );
        setIsInputFocused(!!isInput);
        return !!isInput;
    }, []);

    // Monitor focus changes
    useEffect(() => {
        const handleFocusChange = () => checkInputFocus();

        // Listen to focus/blur at capture phase to catch everything
        window.addEventListener('focus', handleFocusChange, true);
        window.addEventListener('blur', handleFocusChange, true);

        return () => {
            window.removeEventListener('focus', handleFocusChange, true);
            window.removeEventListener('blur', handleFocusChange, true);
        };
    }, [checkInputFocus]);

    // Global Keydown Handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isInput = checkInputFocus();

            // ESC: Universal Dismiss
            if (e.key === 'Escape') {
                // If input is focused, we might want to blur it OR close parent
                // User requested: ESC to blur or close parent.
                // Current strategy: Always try to dismiss UI layer first.
                // If backNav handles it (returns true), we stop.
                // If backNav doesn't handle it (no UI open), then we blur input.

                const handled = handleBackPress('escape');
                if (handled) {
                    // Prevent default ESC behavior if we closed a UI element
                    // This creates a "native" feel
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }

                if (isInput && document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                    e.preventDefault();
                }
                return;
            }

            // Shortcuts (Only if not typing)
            if (!isInput && !e.repeat) {
                // Future: Handle shortcuts like CTRL+K
                // const handler = shortcuts.get(e.key); // Simplified
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleBackPress, checkInputFocus, shortcuts]);

    const registerShortcut = useCallback((key: string, handler: () => void) => {
        shortcuts.set(key, handler);
    }, [shortcuts]);

    const unregisterShortcut = useCallback((key: string) => {
        shortcuts.delete(key);
    }, [shortcuts]);

    return (
        <KeyboardContext.Provider value={{ isInputFocused, registerShortcut, unregisterShortcut }}>
            {children}
        </KeyboardContext.Provider>
    );
}

export function useKeyboard() {
    const context = useContext(KeyboardContext);
    if (!context) throw new Error('useKeyboard must be used within KeyboardProvider');
    return context;
}

/**
 * Hook for Chat/Comment Inputs
 * Handles ENTER to send, SHIFT+ENTER for newline
 */
export function useChatInputKeyHandler(onSend: () => void) {
    return useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend();
        }
    }, [onSend]);
}
