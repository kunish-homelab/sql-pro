import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { sqlPro } from '@/lib/api';
import {
  useChangesStore,
  useCommandPaletteStore,
  useConnectionStore,
  useTableDataStore,
} from '@/stores';

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
          // Trigger file picker
          const openButton = document.querySelector<HTMLButtonElement>(
            'button:has(.lucide-folder-open)'
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
                  connectionStore.setConnection({
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
          const { connection, setConnection, setSchema, setSelectedTable } =
            connectionStore;
          if (connection) {
            sqlPro.db.close({ connectionId: connection.id }).then(() => {
              setConnection(null);
              setSchema(null);
              setSelectedTable(null);
              changesStore.clearChanges();
              tableDataStore.reset();
              navigate({ to: '/' });
            });
          }
          break;
        }

        case 'refresh-schema': {
          const { connection, setIsLoadingSchema, setSchema } = connectionStore;
          if (connection) {
            setIsLoadingSchema(true);
            sqlPro.db
              .getSchema({ connectionId: connection.id })
              .then((result) => {
                if (result.success) {
                  setSchema({
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
          document
            .querySelector<HTMLButtonElement>('button:has(.lucide-settings)')
            ?.click();
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
          document
            .querySelector<HTMLButtonElement>('button:has(.lucide-play)')
            ?.click();
          break;
        }

        case 'toggle-history': {
          document
            .querySelector<HTMLButtonElement>('button:has(.lucide-history)')
            ?.click();
          break;
        }
      }
    });

    return cleanup;
  }, [navigate, toggle]);
}
