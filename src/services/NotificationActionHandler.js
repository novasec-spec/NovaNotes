// src/services/NotificationActionHandler.js
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import MusicPlayerService from './MusicPlayerService';

export async function setupNotificationActionHandler() {
  if (Platform.OS === 'android') {
    // Set notification handler for custom actions
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });

    // Handle notification responses (for custom notification actions)
    const subscription = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const actionId = response.actionIdentifier;
        console.log('📱 Notification action:', actionId);

        switch (actionId) {
          case 'play':
            await MusicPlayerService.play();
            break;
          case 'pause':
            await MusicPlayerService.pause();
            break;
          case 'next':
            await MusicPlayerService.skipToNext();
            break;
          case 'previous':
            await MusicPlayerService.skipToPrevious();
            break;
          case 'stop':
            await MusicPlayerService.stop();
            break;
          default:
            console.log('Unknown action:', actionId);
        }
      }
    );

    return () => subscription.remove();
  }
}
