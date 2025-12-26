import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router';
import { useConnectionStore } from '@/stores';
import { DatabasePage } from './database';
import { RouterErrorFallback } from './error';
import { RootLayout } from './root';
import { WelcomePage } from './welcome';

// Root route with layout
const rootRoute = createRootRoute({
  component: RootLayout,
  errorComponent: RouterErrorFallback,
});

// Welcome route (index) - shown when not connected
const welcomeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: WelcomePage,
  beforeLoad: () => {
    const { connection } = useConnectionStore.getState();
    if (connection) {
      throw redirect({ to: '/database' });
    }
  },
});

// Database route - shown when connected
const databaseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/database',
  component: DatabasePage,
  beforeLoad: () => {
    const { connection } = useConnectionStore.getState();
    if (!connection) {
      throw redirect({ to: '/' });
    }
  },
});

// Create the route tree
const routeTree = rootRoute.addChildren([welcomeRoute, databaseRoute]);

// Create and export the router
export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

// Register the router for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
