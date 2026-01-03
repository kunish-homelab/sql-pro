/**
 * Wraps an async handler with consistent error handling
 */
export function createHandler<T, R>(
  handler: (request: T) => Promise<R>
): (
  _event: any,
  request: T
) => Promise<{ success: boolean; error?: string } & R> {
  return async (_event, request) => {
    try {
      const result = await handler(request);
      return { success: true, ...result } as any;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Operation failed',
      };
    }
  };
}
