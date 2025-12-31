import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { useEffect } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { TooltipProvider } from '@/components/ui/tooltip';
import { sqlPro } from '@/lib/api';
import { initMockMode, isMockMode } from '@/lib/mock-api';
import { queryClient } from '@/lib/query-client';
import { router } from '@/routes';
import {
  useAIStore,
  useConnectionStore,
  useProStore,
  useQueryTabsStore,
  useTableDataStore,
  useThemeStore,
} from '@/stores';

function App(): React.JSX.Element {
  const { setRecentConnections, addConnection, setSchema, activeConnectionId } =
    useConnectionStore();
  const { setActiveConnectionId: setTabsActiveConnection } =
    useQueryTabsStore();
  const { setActiveConnectionId: setTableDataActiveConnection } =
    useTableDataStore();
  const { loadTheme } = useThemeStore();
  const { loadSettings: loadAISettings } = useAIStore();
  const { loadStatus: loadProStatus } = useProStore();

  // Load theme and AI settings from main process on mount
  useEffect(() => {
    loadTheme();
    loadAISettings();
  }, [loadTheme, loadAISettings]);

  // Load Pro status on mount
  useEffect(() => {
    loadProStatus();
  }, [loadProStatus]);

  // Sync active connection across stores
  useEffect(() => {
    if (activeConnectionId) {
      setTabsActiveConnection(activeConnectionId);
      setTableDataActiveConnection(activeConnectionId);
    }
  }, [
    activeConnectionId,
    setTabsActiveConnection,
    setTableDataActiveConnection,
  ]);

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
            addConnection(mockData.connection);
            if (mockData.schema) {
              setSchema(mockData.connection.id, mockData.schema);
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
  }, [setRecentConnections, addConnection, setSchema]);

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
