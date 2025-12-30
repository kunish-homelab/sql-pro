import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { sqlPro } from '@/lib/api';
import {
  useChangesStore,
  useCommandPaletteStore,
  useConnectionStore,
  useTableDataStore,
} from '@/stores';

// Check if we're in Electron environment with window API
const hasWindowAPI = (): boolean => {
  return typeof window !== 'undefined' && !!window.sqlPro?.window;
};

/**
 * Hook that listens for menu actions from the main process.
 * Should be called once at the app root level.
 */
export function useMenuActions() {
  const navigate = useNavigate();
  const toggle = useCommandPaletteStore((s) => s.toggle);

  useEffect(() => {
    // Check if we're in Electron environment
    if (!window.sqlPro?.menu?.onAction) {
      return;
    }

    const cleanup = window.sqlPro.menu.onAction((action) => {
      const connectionStore = useConnectionStore.getState();
      const changesStore = useChangesStore.getState();
      const tableDataStore = useTableDataStore.getState();

      switch (action) {
        case 'open-database': {
          // Try to find the button by data-action attribute
          const openButton = document.querySelector<HTMLButtonElement>(
            'button[data-action="open-database"]'
          );
          if (openButton) {
            openButton.click();
          } else {
            // If no button found, open file dialog directly
            sqlPro.dialog.openFile().then(async (result) => {
              if (result.success && result.filePath) {
                const openResult = await sqlPro.db.open({
                  path: result.filePath,
                });
                if (openResult.success && openResult.connection) {
                  connectionStore.addConnection({
                    id: openResult.connection.id,
                    path: openResult.connection.path,
                    filename: openResult.connection.filename,
                    isEncrypted: openResult.connection.isEncrypted,
                    isReadOnly: openResult.connection.isReadOnly,
                    status: 'connected',
                    connectedAt: new Date(),
                  });
                  navigate({ to: '/database' });
                }
              }
            });
          }
          break;
        }

        case 'close-database': {
          const {
            connection,
            activeConnectionId,
            removeConnection,
            setSelectedTable,
          } = connectionStore;
          if (connection && activeConnectionId) {
            sqlPro.db.close({ connectionId: connection.id }).then(() => {
              removeConnection(activeConnectionId);
              setSelectedTable(null);
              changesStore.clearChangesForConnection(activeConnectionId);
              tableDataStore.resetConnection(activeConnectionId);
              navigate({ to: '/' });
            });
          }
          break;
        }

        case 'refresh-schema': {
          const {
            connection,
            activeConnectionId,
            setIsLoadingSchema,
            setSchema,
          } = connectionStore;
          if (connection && activeConnectionId) {
            setIsLoadingSchema(true);
            sqlPro.db
              .getSchema({ connectionId: connection.id })
              .then((result) => {
                if (result.success) {
                  setSchema(activeConnectionId, {
                    schemas: result.schemas || [],
                    tables: result.tables || [],
                    views: result.views || [],
                  });
                }
              })
              .finally(() => {
                setIsLoadingSchema(false);
              });
          }
          break;
        }

        case 'open-settings': {
          // Try data-action first, then fallback to icon selector
          const settingsButton =
            document.querySelector<HTMLButtonElement>(
              'button[data-action="open-settings"]'
            ) ||
            document.querySelector<HTMLButtonElement>(
              'button[aria-label="Settings"]'
            );
          settingsButton?.click();
          break;
        }

        case 'open-plugins': {
          navigate({ to: '/plugins' });
          break;
        }

        case 'toggle-command-palette': {
          toggle();
          break;
        }

        case 'switch-to-data': {
          document
            .querySelector<HTMLButtonElement>('[data-tab="data"]')
            ?.click();
          break;
        }

        case 'switch-to-query': {
          document
            .querySelector<HTMLButtonElement>('[data-tab="query"]')
            ?.click();
          break;
        }

        case 'execute-query': {
          // Try data-action first, then fallback
          const executeButton =
            document.querySelector<HTMLButtonElement>(
              'button[data-action="execute-query"]'
            ) ||
            document.querySelector<HTMLButtonElement>(
              'button[aria-label="Execute"]'
            );
          executeButton?.click();
          break;
        }

        case 'toggle-history': {
          const historyButton =
            document.querySelector<HTMLButtonElement>(
              'button[data-action="toggle-history"]'
            ) ||
            document.querySelector<HTMLButtonElement>(
              'button[aria-label="History"]'
            );
          historyButton?.click();
          break;
        }

        case 'new-window': {
          if (hasWindowAPI()) {
            sqlPro.window.create();
          }
          break;
        }
      }
    });

    return cleanup;
  }, [navigate, toggle]);
}
