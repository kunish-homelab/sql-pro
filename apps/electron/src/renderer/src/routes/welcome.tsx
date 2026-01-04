import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { useConnectionStore } from '@/stores';

/**
 * Welcome page route component.
 * Displays the welcome screen and handles navigation when connected.
 */
export function WelcomePage() {
  const navigate = useNavigate();
  const { connection } = useConnectionStore();

  // Navigate to database view when connected
  useEffect(() => {
    if (connection) {
      navigate({ to: '/database' });
    }
  }, [connection, navigate]);

  return <WelcomeScreen />;
}
