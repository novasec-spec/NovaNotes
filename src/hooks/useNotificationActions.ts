import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { notificationService } from '../services/notificationservice';

/**
 * Hook to handle notification action button presses
 * Place this in your root layout or a high-level component
 */
export function useNotificationActions() {
  useEffect(() => {
    // Listen for action button presses
    const subscription = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const actionIdentifier = response.actionIdentifier;
        const notificationData = response.notification.request.content.data;

        console.log('🔘 Action button pressed:', actionIdentifier);

        // Handle the action
        await notificationService.handleAction(actionIdentifier, notificationData);

        // If action opens app, handle navigation
        if (actionIdentifier === 'reply') {
          // Navigation handled by your existing router logic
        }
      }
    );

    return () => subscription.remove();
  }, []);
}
