// src/services/NotificationActionHandler.ts
import * as Notifications from 'expo-notifications';
import NowPlayingService from './NowPlayingService';

export function setupNotificationActionHandler() {
  // Handle notification responses
  Notifications.addNotificationResponseReceivedListener((response) => {
    const { actionIdentifier, notification } = response;
    const data = notification.request.content.data;

    if (data?.type === 'now_playing') {
      handleNowPlayingAction(actionIdentifier);
    }
  });
}

function handleNowPlayingAction(action: string) {
  switch (action) {
    case 'PLAY_PAUSE':
      NowPlayingService.togglePlayPause();
      break;
    case 'NEXT':
      // Handle next track
      console.log('Next track');
      break;
    case 'PREVIOUS':
      // Handle previous track
      console.log('Previous track');
      break;
    case 'CLOSE':
      NowPlayingService.hideNowPlaying();
      break;
    default:
      break;
  }
}
