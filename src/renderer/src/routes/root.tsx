import { aiDevtoolsPlugin } from '@tanstack/react-ai-devtools';
import { TanStackDevtools } from '@tanstack/react-devtools';
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools';
import { Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import { useEffect } from 'react';
import { CommandPalette } from '@/components/CommandPalette';
import { useCommands } from '@/hooks/useCommands';
import { useMenuActions } from '@/hooks/useMenuActions';
import { isMockMode } from '@/lib/mock-api';
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
  useEffect(() => {
    const root = document.documentElement;
    if (uiFont.family) {
      root.style.setProperty('--font-ui-family', uiFont.family);
    } else {
      root.style.removeProperty('--font-ui-family');
    }
    root.style.setProperty('--font-ui-size', `${uiFont.size}px`);
  }, [uiFont.family, uiFont.size]);

  return (
    <div
      className="bg-background text-foreground flex h-screen flex-col overflow-hidden"
      style={{
        fontFamily: uiFont.family
          ? `"${uiFont.family}", system-ui, sans-serif`
          : undefined,
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

      {/* TanStack DevTools - only visible in development, hidden in mock mode */}
      {import.meta.env.DEV && !isMockMode() && (
        <TanStackDevtools
          plugins={[
            aiDevtoolsPlugin(),
            {
              name: 'TanStack Query',
              render: <ReactQueryDevtoolsPanel />,
              defaultOpen: true,
            },
            {
              name: 'TanStack Router',
              render: <TanStackRouterDevtoolsPanel />,
              defaultOpen: false,
            },
          ]}
        />
      )}
    </div>
  );
}
