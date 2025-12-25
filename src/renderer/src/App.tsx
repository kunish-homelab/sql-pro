import { useEffect } from 'react';
import { useConnectionStore } from '@/stores';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { DatabaseView } from '@/components/DatabaseView';
import { TooltipProvider } from '@/components/ui/tooltip';

function App(): JSX.Element {
  const { connection, setRecentConnections } = useConnectionStore();

  // Load recent connections on mount
  useEffect(() => {
    const loadRecentConnections = async () => {
      const result = await window.sqlPro.app.getRecentConnections();
      if (result.success && result.connections) {
        setRecentConnections(result.connections);
      }
    };
    loadRecentConnections();
  }, [setRecentConnections]);

  return (
    <TooltipProvider>
      <div className="flex h-screen flex-col bg-background text-foreground">
        {connection ? <DatabaseView /> : <WelcomeScreen />}
      </div>
    </TooltipProvider>
  );
}

export default App;
