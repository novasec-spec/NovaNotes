// src/services/NotificationHandler.ts
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import CallService from './CallService';
import { safePush } from '../utils/navigation';

const INCOMING_CALL_CATEGORY = 'incoming_call';
const CALL_CHANNEL_ID = 'calls';

export class NotificationHandler {
  private static subs: Notifications.Subscription[] = [];

  static async setup() {
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const isCall = notification.request.content.data?.type === 'incoming_call';
        return {
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          priority: isCall ? Notifications.AndroidNotificationPriority.MAX : Notifications.AndroidNotificationPriority.DEFAULT,
        };
      },
    });

    await this.ensureCallChannel();
    await this.registerCategories();

    // Tapped (including tapping an action button)
    this.subs.push(Notifications.addNotificationResponseReceivedListener(this.handleResponse));

    // Received while app is FOREGROUNDED — this is what lets the incoming
    // call screen open automatically without the user tapping anything.
    // (Background/killed-app auto-open isn't achievable with Expo push
    // alone — that needs native VoIP push + CallKit, a bigger native
    // undertaking. See README "Known limitations".)
    this.subs.push(Notifications.addNotificationReceivedListener(this.handleReceivedForeground));

    return () => this.teardown();
  }

  static teardown() {
    this.subs.forEach((s) => s.remove());
    this.subs = [];
  }

  private static async ensureCallChannel() {
    if (Platform.OS !== 'android') return;
    await Notifications.setNotificationChannelAsync(CALL_CHANNEL_ID, {
      name: 'Incoming Calls',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 500, 500],
      sound: 'default',
      bypassDnd: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  private static async registerCategories() {
    await Notifications.setNotificationCategoryAsync(INCOMING_CALL_CATEGORY, [
      { identifier: 'accept', buttonTitle: 'Accept', options: { opensAppToForeground: true } },
      { identifier: 'decline', buttonTitle: 'Decline', options: { opensAppToForeground: false, isDestructive: true } },
    ]);
  }

  private static handleReceivedForeground = (notification: Notifications.Notification) => {
    const data = notification.request.content.data as Record<string, any> | undefined;
    if (data?.type !== 'incoming_call' || !data.callId) return;
    navigateToIncoming(data);
  };

  private static handleResponse = async (response: Notifications.NotificationResponse) => {
    const data = response.notification.request.content.data as Record<string, any> | undefined;
    if (!data?.type) return;

    const actionId = response.actionIdentifier;

    switch (data.type) {
      case 'incoming_call': {
        if (actionId === 'decline') {
          if (data.callId) await CallService.declineCall(data.callId);
          return;
        }
        if (actionId === 'accept') {
          if (!data.callId) return;
          const result = await CallService.acceptCall(data.callId);
          if (result) navigateToVideoOrAudio(data);
          return;
        }
        // Plain tap — show the full incoming screen
        navigateToIncoming(data);
        break;
      }

      case 'call_accepted':
        navigateToVideoOrAudio(data);
        break;

      case 'call_ended':
      case 'call_declined':
      case 'call_missed':
        if (router.canGoBack()) router.back();
        break;

      default:
        break;
    }
  };

  static async registerForPushNotifications(): Promise<string | null> {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') {
      console.warn('Push permission denied');
      return null;
    }
    try {
      const { data: token } = await Notifications.getExpoPushTokenAsync();
      await CallService.registerPushToken(token);
      return token;
    } catch (error) {
      console.error('❌ getExpoPushTokenAsync error:', error);
      return null;
    }
  }
}

function navigateToIncoming(data: Record<string, any>) {
  router.push({
    pathname: '/IncomingCallScreen',
    params: {
      callId: data.callId,
      callerId: data.callerId,
      callerName: data.callerName,
      callerAvatar: data.callerAvatar,
      type: data.callType || 'video',
    },
  });
}

function navigateToVideoOrAudio(data: Record<string, any>) {
  const pathname =
    data.callType === 'audio'
      ? '/AudioCallScreen'
      : '/VideoCallScreen';

  safePush({
    pathname,
    params: {
      callId: data.callId,
      otherUserId: data.callerId || data.calleeId,
      otherUserName:
        data.callerName || data.calleeName,
      otherUserAvatar:
        data.callerAvatar || data.calleeAvatar,
      isCaller: 'false',
    },
  });
}
export default NotificationHandler;
