import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { DatabaseView } from '@/components/DatabaseView';
import { useConnectionStore } from '@/stores';

/**
 * Database page route component.
 * Displays the database view and handles navigation when disconnected.
 */
export function DatabasePage() {
  const navigate = useNavigate();
  const { connection } = useConnectionStore();

  // Navigate back to welcome when disconnected
  useEffect(() => {
    if (!connection) {
      navigate({ to: '/' });
    }
  }, [connection, navigate]);

  if (!connection) {
    return null;
  }

  return <DatabaseView />;
}
