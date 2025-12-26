import type { ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { useConnectionStore } from '@/stores';

// Test component that throws an error
function ErrorThrower(): ReactNode {
  throw new Error('Test error from ErrorThrower component');
}

/**
 * Welcome page route component.
 * Displays the welcome screen and handles navigation when connected.
 */
export function WelcomePage() {
  const navigate = useNavigate();
  const { connection } = useConnectionStore();
  const [shouldThrow, setShouldThrow] = useState(false);

  // Navigate to database view when connected
  useEffect(() => {
    if (connection) {
      navigate({ to: '/database' });
    }
  }, [connection, navigate]);

  return (
    <>
      {shouldThrow && <ErrorThrower />}
      <WelcomeScreen />
      {/* Temporary test button - remove after testing */}
      {import.meta.env.DEV && (
        <button
          onClick={() => setShouldThrow(true)}
          className="fixed bottom-4 left-4 rounded bg-red-500 px-3 py-1 text-sm text-white"
        >
          Test Error
        </button>
      )}
    </>
  );
}
