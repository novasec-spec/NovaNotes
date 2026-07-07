// src/services/NotificationHandler.ts
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import CallService from './CallService';

const INCOMING_CALL_CATEGORY = 'incoming_call';

export class NotificationHandler {
  private static subscriptions: Notifications.Subscription[] = [];

  static async setup() {
    // Foreground behavior
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const type = notification.request.content.data?.type;
        return {
          // Incoming-call notifications should always interrupt, even in foreground
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          priority:
            type === 'incoming_call'
              ? Notifications.AndroidNotificationPriority.MAX
              : Notifications.AndroidNotificationPriority.DEFAULT,
        };
      },
    });

    await this.registerCategories();

    const responseSub = Notifications.addNotificationResponseReceivedListener(
      this.handleNotificationResponse
    );
    this.subscriptions.push(responseSub);

    return () => this.teardown();
  }

  static teardown() {
    this.subscriptions.forEach((s) => s.remove());
    this.subscriptions = [];
  }

  /** Registers the interactive Accept/Decline buttons Android/iOS render on the notification itself. */
  private static async registerCategories() {
    await Notifications.setNotificationCategoryAsync(INCOMING_CALL_CATEGORY, [
      {
        identifier: 'accept',
        buttonTitle: 'Accept',
        options: { opensAppToForeground: true },
      },
      {
        identifier: 'decline',
        buttonTitle: 'Decline',
        options: { opensAppToForeground: false, isDestructive: true },
      },
    ]);
  }

  static handleNotificationResponse = async (response: Notifications.NotificationResponse) => {
    const data = response.notification.request.content.data as Record<string, any> | undefined;
    if (!data?.type) {
      console.warn('📨 Notification with no data.type — ignoring');
      return;
    }

    const actionId = response.actionIdentifier; // 'accept' | 'decline' | Notifications.DEFAULT_ACTION_IDENTIFIER
    console.log('📨 Notification response:', data.type, actionId);

    switch (data.type) {
      case 'incoming_call': {
        if (actionId === 'decline') {
          // User declined right from the notification tray — don't open the app UI at all.
          if (data.callId) await CallService.declineCall(data.callId);
          return;
        }

        if (actionId === 'accept') {
          // Accept in the background, then land straight on the connected call.
          if (!data.callId) return;
          const tokenData = await CallService.acceptCall(data.callId);
          if (tokenData) {
            router.push({
              pathname: '/CallScreen',
              params: {
                callId: data.callId,
                calleeId: data.callerId,
                calleeName: data.callerName,
                calleeAvatar: data.callerAvatar,
                type: data.callType || 'video',
                isCaller: 'false',
                preAccepted: 'true',
              },
            });
          }
          return;
        }

        // Default tap (opened the app) — show the full incoming-call screen
        // so the user can still see who's calling before deciding.
        router.push({
          pathname: '/IncomingCallScreen',
          params: {
            callId: data.callId,
            callerId: data.callerId,
            callerName: data.callerName,
            callerAvatar: data.callerAvatar,
            roomName: data.roomName,
            type: data.callType || 'video',
          },
        });
        break;
      }

      case 'call_accepted':
        router.push({
          pathname: '/CallScreen',
          params: {
            callId: data.callId,
            calleeId: data.calleeId,
            calleeName: data.calleeName,
            calleeAvatar: data.calleeAvatar,
            type: data.callType || 'video',
            isCaller: 'true',
          },
        });
        break;

      case 'call_ended':
      case 'call_declined':
      case 'call_missed':
        // The active/incoming call screens already listen for these via
        // CallService.subscribeToCall in realtime — this is just a fallback
        // for when the notification arrives while no call screen is mounted.
        if (router.canGoBack()) router.back();
        break;

      default:
        break;
    }
  };

  static async registerForPushNotifications(): Promise<string | null> {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Push notification permissions denied');
      return null;
    }

    try {
      // projectId is required for EAS builds — reads from app config automatically
      // when using expo-constants under the hood in newer SDKs; pass explicitly
      // if your setup needs it: getExpoPushTokenAsync({ projectId: '...' })
      const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync();
      await CallService.registerPushToken(expoPushToken);
      return expoPushToken;
    } catch (error) {
      console.error('❌ Get push token error:', error);
      return null;
    }
  }
}
