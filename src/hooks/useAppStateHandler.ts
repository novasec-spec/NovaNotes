import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useEnhancedNotificationHandler } from '../hooks/useEnhancedNotificationHandler';

/**
 * Root layout enhancement that manages app state and notification handling
 * Prevents crashes from invalid routes triggered by notifications/calls
 */
export const useAppStateHandler = () => {
  const appState = useRef(AppState.currentState);
  const { setupNotificationListeners } = useEnhancedNotificationHandler();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Setup notification listeners on mount
    unsubscribeRef.current = setupNotificationListeners();

    // Handle app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
      unsubscribeRef.current?.();
    };
  }, []);

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    const previousAppState = appState.current;

    // Log state transitions for debugging
    console.log(
      `[AppState] Transition: ${previousAppState} -> ${nextAppState}`
    );

    if (previousAppState.match(/inactive|background/) && nextAppState === 'active') {
      console.log('[AppState] App has come to foreground');
      // Re-setup notification listeners when app comes to foreground
      unsubscribeRef.current?.();
      unsubscribeRef.current = setupNotificationListeners();
    } else if (nextAppState.match(/inactive|background/)) {
      console.log('[AppState] App has gone to background');
    }

    appState.current = nextAppState;
  };

  return { appState };
};

/**
 * Deep link handler that validates routes before navigation
 */
export const useDeepLinkHandler = () => {
  const { navigate } = require('../utils/safeNavigation').useSafeNavigation();

  const handleDeepLink = (url: string) => {
    try {
      console.log('[DeepLink] Processing:', url);

      // Parse the deep link URL
      const { hostname, pathname, searchParams } = new URL(url);

      // Map hostname to route
      const routeMap: Record<string, string> = {
        'chat': '/(tabs)/chat',
        'call': '/IncomingCallScreen',
        'video': '/VideoCallScreen',
        'audio': '/AudioCallScreen',
      };

      const route = routeMap[hostname];
      if (!route) {
        console.warn(`[DeepLink] Unknown hostname: ${hostname}`);
        return;
      }

      // Extract query parameters
      const params: Record<string, any> = {};
      searchParams.forEach((value, key) => {
        params[key] = value;
      });

      navigate(route, params);
    } catch (error) {
      console.error('[DeepLink] Error handling deep link:', error);
    }
  };

  return { handleDeepLink };
};
