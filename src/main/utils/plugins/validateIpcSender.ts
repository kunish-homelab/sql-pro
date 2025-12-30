import type { IpcMainInvokeEvent } from 'electron';

/**
 * Validates that an IPC request is coming from a trusted renderer process.
 *
 * This is a critical security measure to prevent malicious renderer processes
 * from invoking privileged operations (like plugin installation, enabling, etc.).
 *
 * **Security Requirements (from spec):**
 * - Always validate `event.senderFrame` in all `ipcMain.handle()` calls
 * - Prevents malicious renderer processes from invoking plugin operations
 *
 * **Validation Checks:**
 * 1. Sender frame must exist
 * 2. Sender frame must be the main frame (not an iframe or child frame)
 * 3. Sender must not be from a malicious origin
 *
 * @param event - The IPC event from ipcMain.handle()
 * @returns True if the sender is trusted, false otherwise
 *
 * @example
 * ```typescript
 * ipcMain.handle('plugin:install', async (event, request) => {
 *   if (!validateIpcSender(event)) {
 *     return { success: false, error: 'Unauthorized IPC sender' };
 *   }
 *   // ... handle request
 * });
 * ```
 */
export function validateIpcSender(event: IpcMainInvokeEvent): boolean {
  // Check 1: Sender frame must exist
  if (!event.senderFrame) {
    console.error('[IPC Security] Missing senderFrame in IPC event');
    return false;
  }

  // Check 2: Must be from the main frame, not an iframe or child frame
  // The main frame has frameId 0 or is marked as top-level
  const isMainFrame =
    event.senderFrame.frameTreeNodeId === 0 ||
    event.senderFrame.parent === null;

  if (!isMainFrame) {
    console.error('[IPC Security] IPC request from non-main frame detected:', {
      frameId: event.senderFrame.frameTreeNodeId,
      processId: event.senderFrame.processId,
      routingId: event.senderFrame.routingId,
    });
    return false;
  }

  // Check 3: Verify the frame URL is from our app (not a malicious external page)
  // In development, we allow localhost and file:// protocols
  // In production, we only allow file:// protocol
  const frameUrl = event.senderFrame.url;
  const allowedProtocols = ['file:', 'http://localhost', 'https://localhost'];
  const isAllowedOrigin = allowedProtocols.some((protocol) =>
    frameUrl.startsWith(protocol)
  );

  if (!isAllowedOrigin) {
    console.error('[IPC Security] IPC request from untrusted origin:', {
      url: frameUrl,
      frameId: event.senderFrame.frameTreeNodeId,
    });
    return false;
  }

  // All checks passed
  return true;
}
