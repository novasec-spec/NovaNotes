import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { useRouter } from 'expo-router';
import { useSafeNavigation } from '../utils/safeNavigation';

const NOTIFICATION_TASK_NAME = 'HANDLE_NOTIFICATION_TASK';

interface NotificationPayload {
  route?: string;
  chatId?: string;
  callType?: 'audio' | 'video' | 'incoming';
  userId?: string;
  [key: string]: any;
}

/**
 * Enhanced notification handler with validation and error recovery
 * Prevents "route not found" crashes by validating routes before navigation
 */
export const useEnhancedNotificationHandler = () => {
  const router = useRouter();
  const { navigate, replace } = useSafeNavigation();

  // Register notification task for background handling
  if (!TaskManager.isTaskRegisteredAsync(NOTIFICATION_TASK_NAME)) {
    TaskManager.defineTask(NOTIFICATION_TASK_NAME, async (event) => {
      try {
        const notification = event.notification;
        handleNotificationNavigation(notification.request.content.data);
      } catch (error) {
        console.error('[NotificationTask] Error handling background notification:', error);
      }
    });
  }

  const handleNotificationNavigation = (payload: NotificationPayload) => {
    try {
      // Extract navigation data from payload
      const { route, chatId, callType, userId } = payload;

      if (!route && !callType) {
        console.warn('[Notification] No navigation data in payload:', payload);
        return;
      }

      // Handle call-type notifications
      if (callType) {
        switch (callType) {
          case 'incoming':
            navigate('/IncomingCallScreen', { callerId: userId });
            break;
          case 'audio':
            navigate('/AudioCallScreen', { userId });
            break;
          case 'video':
            navigate('/VideoCallScreen', { userId });
            break;
          default:
            console.warn(`[Notification] Unknown call type: ${callType}`);
        }
        return;
      }

      // Handle chat notifications
      if (route === 'chat' && chatId) {
        navigate('/(tabs)/chat/chatroom', { chatId });
        return;
      }

      // Handle custom routes with validation
      if (route) {
        navigate(route, { userId, chatId });
      }
    } catch (error) {
      console.error('[NotificationNavigation] Error navigating to notification:', error);
      // Fall back to chat list on error
      navigate('/(tabs)/chat/chatlist');
    }
  };

  const setupNotificationListeners = () => {
    // Listener for notifications received while app is in foreground
    const foregroundListener = Notifications.addNotificationReceivedListener((notification) => {
      try {
        const payload = notification.request.content.data as NotificationPayload;
        console.log('[Notification] Received in foreground:', payload);
        
        // Handle foreground notification
        handleNotificationNavigation(payload);
      } catch (error) {
        console.error('[NotificationListener] Foreground error:', error);
      }
    });

    // Listener for notification responses (user tap)
    const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        const payload = response.notification.request.content.data as NotificationPayload;
        console.log('[Notification] User tapped notification:', payload);
        
        handleNotificationNavigation(payload);
      } catch (error) {
        console.error('[NotificationListener] Response error:', error);
      }
    });

    return () => {
      Notifications.removeNotificationSubscription(foregroundListener);
      Notifications.removeNotificationSubscription(responseListener);
    };
  };

  return {
    handleNotificationNavigation,
    setupNotificationListeners,
  };
};

/**
 * Helper to validate and sanitize notification payloads
 */
export const validateNotificationPayload = (payload: any): NotificationPayload | null => {
  if (!payload || typeof payload !== 'object') {
    console.warn('[Validation] Invalid payload type:', typeof payload);
    return null;
  }

  // Extract known fields only
  const validPayload: NotificationPayload = {};

  if (payload.route && typeof payload.route === 'string') {
    validPayload.route = payload.route;
  }

  if (payload.chatId && typeof payload.chatId === 'string') {
    validPayload.chatId = payload.chatId;
  }

  if (payload.callType && ['audio', 'video', 'incoming'].includes(payload.callType)) {
    validPayload.callType = payload.callType;
  }

  if (payload.userId && typeof payload.userId === 'string') {
    validPayload.userId = payload.userId;
  }

  return Object.keys(validPayload).length > 0 ? validPayload : null;
};
