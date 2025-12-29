import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { useEffect } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { TooltipProvider } from '@/components/ui/tooltip';
import { sqlPro } from '@/lib/api';
import { initMockMode, isMockMode } from '@/lib/mock-api';
import { queryClient } from '@/lib/query-client';
import { router } from '@/routes';
import { useConnectionStore, useThemeStore } from '@/stores';

function App(): React.JSX.Element {
  const { setRecentConnections, setConnection, setSchema } =
    useConnectionStore();
  const { loadTheme } = useThemeStore();

  // Load theme from main process on mount
  useEffect(() => {
    loadTheme();
  }, [loadTheme]);

  // Load recent connections on mount
  useEffect(() => {
    const loadRecentConnections = async () => {
      // Initialize mock mode if enabled
      if (isMockMode()) {
        // Check if we should skip auto-connect (for screenshot purposes)
        const hashParams = new URLSearchParams(
          window.location.hash.split('?')[1] || ''
        );
        const skipAutoConnect = hashParams.get('skipAutoConnect') === 'true';

        if (!skipAutoConnect) {
          const mockData = await initMockMode();
          if (mockData) {
            setConnection(mockData.connection);
            if (mockData.schema) {
              setSchema(mockData.schema);
            }
            // Navigate to database view after mock connection is set
            router.navigate({ to: '/database' });
            return;
          }
        }
      }

      const result = await sqlPro.app.getRecentConnections();
      if (result.success && result.connections) {
        setRecentConnections(result.connections);
      }
    };
    loadRecentConnections();
  }, [setRecentConnections, setConnection, setSchema]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
