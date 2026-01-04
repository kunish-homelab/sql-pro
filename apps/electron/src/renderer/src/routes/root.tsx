import { Outlet } from '@tanstack/react-router';
import { CommandPalette } from '@/components/CommandPalette';
import { getFontFamilyCSS, useApplyFont } from '@/hooks/useApplyFont';
import { useCommands } from '@/hooks/useCommands';
import { useMenuActions } from '@/hooks/useMenuActions';
import { useUIFont } from '@/stores';

/**
 * Root layout component that wraps all routes.
 * Provides the common app shell with titlebar and DevTools.
 */
export function RootLayout() {
  const uiFont = useUIFont();

  // Register commands and global keyboard shortcuts
  useCommands();

  // Listen for menu actions from main process
  useMenuActions();

  // Apply UI font to document root
  useApplyFont(uiFont, 'ui');

  return (
    <div
      className="bg-background text-foreground flex h-screen flex-col overflow-hidden"
      style={{
        fontFamily: getFontFamilyCSS(uiFont.family),
        fontSize: `${uiFont.size}px`,
      }}
    >
      {/* Titlebar - draggable area for macOS traffic lights */}
      <div className="titlebar border-border/50 h-10 shrink-0 border-b" />

      {/* Main content - rendered by child routes */}
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>

      {/* Command Palette - global keyboard shortcut ⌘K */}
      <CommandPalette />
    </div>
  );
}
