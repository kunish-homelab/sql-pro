import { TanStackDevtools } from '@tanstack/react-devtools';
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools';
import { Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import { isMockMode } from '@/lib/mock-api';

/**
 * Root layout component that wraps all routes.
 * Provides the common app shell with titlebar and DevTools.
 */
export function RootLayout() {
  return (
    <div className="bg-background text-foreground flex h-screen flex-col overflow-hidden">
      {/* Titlebar - draggable area for macOS traffic lights */}
      <div className="titlebar border-border/50 h-10 shrink-0 border-b" />

      {/* Main content - rendered by child routes */}
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>

      {/* TanStack DevTools - only visible in development, hidden in mock mode */}
      {import.meta.env.DEV && !isMockMode() && (
        <TanStackDevtools
          plugins={[
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
