import { useCallback, useRef } from 'react';

/**
 * Vim command types that can be detected
 */
export type VimCommand =
  // Navigation
  | 'move-down' // j
  | 'move-up' // k
  | 'move-left' // h
  | 'move-right' // l
  | 'jump-top' // gg
  | 'jump-bottom' // G
  | 'jump-start' // 0
  | 'jump-end' // $
  // Actions
  | 'enter-edit' // i or Enter
  | 'exit-mode' // Escape
  | 'toggle-expand' // o
  | 'search' // /
  | 'select'; // Enter

interface UseVimKeyHandlerOptions {
  /**
   * Timeout for multi-key sequences (like gg) in ms
   */
  sequenceTimeout?: number;
}

interface VimKeyResult {
  command: VimCommand | null;
  handled: boolean;
}

/**
 * Hook for handling Vim-style keyboard navigation.
 * Supports single keys (j, k, h, l) and sequences (gg).
 *
 * @example
 * const { handleKey, resetSequence } = useVimKeyHandler();
 *
 * const onKeyDown = (e: KeyboardEvent) => {
 *   const { command, handled } = handleKey(e.key);
 *   if (handled) e.preventDefault();
 *   if (command === 'move-down') moveToNextRow();
 * };
 */
export function useVimKeyHandler(options: UseVimKeyHandlerOptions = {}) {
  const { sequenceTimeout = 500 } = options;

  // Track pending key sequence for multi-key commands
  const pendingKeyRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Reset any pending key sequence
   */
  const resetSequence = useCallback(() => {
    pendingKeyRef.current = null;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  /**
   * Handle a key press and return the vim command if recognized
   */
  const handleKey = useCallback(
    (key: string, shiftKey = false): VimKeyResult => {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Check for sequence completion (gg)
      if (pendingKeyRef.current === 'g' && key === 'g') {
        resetSequence();
        return { command: 'jump-top', handled: true };
      }

      // Reset pending if we got a different key after 'g'
      if (pendingKeyRef.current === 'g' && key !== 'g') {
        resetSequence();
        // Continue to check if this key is a valid command
      }

      // Check for sequence start
      if (key === 'g') {
        pendingKeyRef.current = 'g';
        // Set timeout to clear pending
        timeoutRef.current = setTimeout(resetSequence, sequenceTimeout);
        return { command: null, handled: true };
      }

      // Single key commands
      switch (key) {
        case 'j':
          return { command: 'move-down', handled: true };
        case 'k':
          return { command: 'move-up', handled: true };
        case 'h':
          return { command: 'move-left', handled: true };
        case 'l':
          return { command: 'move-right', handled: true };
        case 'G':
          return { command: 'jump-bottom', handled: true };
        case '0':
          return { command: 'jump-start', handled: true };
        case '$':
          return { command: 'jump-end', handled: true };
        case 'i':
          return { command: 'enter-edit', handled: true };
        case 'o':
          return { command: 'toggle-expand', handled: true };
        case '/':
          return { command: 'search', handled: true };
        case 'Enter':
          return { command: shiftKey ? 'enter-edit' : 'select', handled: true };
        case 'Escape':
          return { command: 'exit-mode', handled: true };
        default:
          return { command: null, handled: false };
      }
    },
    [resetSequence, sequenceTimeout]
  );

  return {
    handleKey,
    resetSequence,
  };
}
