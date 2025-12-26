import { isMockMode, mockSqlProAPI } from './mock-api';

type SqlProAPIType = typeof mockSqlProAPI;

// Get the appropriate API based on mode
const getAPI = (): SqlProAPIType => {
  if (isMockMode()) {
    return mockSqlProAPI;
  }
  return window.sqlPro as SqlProAPIType;
};

// Create a lazy proxy that defers API resolution
// This allows the check to happen at call time, not at import time
export const sqlPro: SqlProAPIType = new Proxy({} as SqlProAPIType, {
  get(_target, prop: string) {
    const api = getAPI();
    const value = api[prop as keyof SqlProAPIType];
    // If the property is an object (like db, dialog, etc.), wrap it in a proxy too
    if (typeof value === 'object' && value !== null) {
      return new Proxy(value, {
        get(_t, p: string) {
          return (
            getAPI()[prop as keyof SqlProAPIType] as Record<string, unknown>
          )[p];
        },
      });
    }
    return value;
  },
});
