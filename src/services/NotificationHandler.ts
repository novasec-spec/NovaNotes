// src/services/NotificationHandler.ts
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

export class NotificationHandler {
  static async setup() {
    // Configure notification handler
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    // Handle notification response
    const subscription = Notifications.addNotificationResponseReceivedListener(
      this.handleNotificationResponse
    );

    return subscription;
  }

  static async handleNotificationResponse(response: Notifications.NotificationResponse) {
    const { data } = response.notification.request.content;
    
    console.log('📨 Notification tapped:', data);

    switch (data.type) {
      case 'incoming_call':
        // Navigate to incoming call screen
        router.push({
          pathname: '/call/IncomingCallScreen',
          params: {
            callId: data.callId,
            callerId: data.callerId,
            callerName: data.callerName,
            callerAvatar: data.callerAvatar,
            roomName: data.roomName,
          },
        });
        break;

      case 'call_accepted':
        // Navigate to call screen
        router.push({
          pathname: '/call/CallScreen',
          params: {
            callId: data.callId,
            calleeId: data.callerId,
            calleeName: data.callerName,
            type: 'video',
            isCaller: 'true',
          },
        });
        break;

      case 'call_ended':
        // Show call ended alert
        // You can show a toast or navigate to previous screen
        router.back();
        break;

      case 'call_declined':
        // Show call declined alert
        router.back();
        break;

      default:
        break;
    }
  }

  static async registerForPushNotifications() {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Push notification permissions denied');
      return false;
    }

    return true;
  }
}
