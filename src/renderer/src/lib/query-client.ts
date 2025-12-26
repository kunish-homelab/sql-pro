import { QueryClient } from '@tanstack/react-query';

/**
 * Global QueryClient instance for TanStack Query / TanStack DB integration.
 * This client manages caching, background refetching, and query state.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Disable automatic refetching - we control when to refetch via IPC
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      // Keep data fresh for 5 minutes
      staleTime: 5 * 60 * 1000,
      // Cache data for 30 minutes
      gcTime: 30 * 60 * 1000,
      // Retry failed queries up to 2 times
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
    },
  },
});
