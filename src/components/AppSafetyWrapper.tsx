import React, { useEffect } from 'react';
import { useAppStateHandler, useDeepLinkHandler } from '../hooks/useAppStateHandler';
import { useEnhancedNotificationHandler } from '../hooks/useEnhancedNotificationHandler';

/**
 * App wrapper component that initializes all safety mechanisms
 * Should wrap your root layout to ensure proper initialization
 */
export const AppSafetyWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { appState } = useAppStateHandler();
  const { handleDeepLink } = useDeepLinkHandler();
  const { setupNotificationListeners } = useEnhancedNotificationHandler();

  useEffect(() => {
    console.log('[AppSafety] Initialization complete');
    
    // Setup error boundary for uncaught errors
    const errorHandler = (error: Error) => {
      console.error('[ErrorBoundary] Uncaught error:', error);
      // Could send to Sentry or other error tracking here
    };

    if (global.ErrorUtils) {
      const originalHandler = global.ErrorUtils.getGlobalHandler();
      global.ErrorUtils.setGlobalHandler((error: any, isFatal: boolean) => {
        errorHandler(error);
        if (originalHandler) {
          originalHandler(error, isFatal);
        }
      });
    }

    return () => {
      if (global.ErrorUtils) {
        global.ErrorUtils.setGlobalHandler(null as any);
      }
    };
  }, []);

  return <>{children}</>;
};

export default AppSafetyWrapper;
