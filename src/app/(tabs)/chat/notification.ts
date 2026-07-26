// src/app/chat/notifications.ts
// Production build:
// - Notification categories with native Reply (text input) + Mark as Read actions
//   for lock-screen / background taps. Note: iOS/Android both have long-standing,
//   currently-open bugs where action buttons can fail to render in background/killed
//   state, and the textInput action can occasionally return placeholder text instead
//   of what the user typed (expo/expo#36282, #32469, #20500). Treat these as a
//   best-effort bonus, not the primary path.
// - The PRIMARY, reliable path: while the app is in the foreground, an in-app
//   banner (see NotificationBanner.tsx) shows Reply + Mark as Read directly in the
//   UI, with a real TextInput your own code controls end to end.
// - A tiny pub/sub (InAppNotificationEmitter) connects "a notification arrived" /
//   "user tapped Reply" to whatever component wants to react — the chat screen,
//   the banner, anywhere — without prop drilling or polling AsyncStorage.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../../config/supabase';
import Constants from 'expo-constants';
 import { logChatNotification, NotificationStore } from './notifications/NotificationStore';

// ── Action / category identifiers ───────────────────────────────────────────
export const CHAT_CATEGORY = 'chat_message';
export const ACTION_REPLY = 'reply';
export const ACTION_MARK_READ = 'mark_read';

// ── Notification payload shape used throughout this module ─────────────────
export interface ChatNotificationData {
  type: 'chat_message';
  chatId: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  messageId?: string;
  preview?: string;
}

// ── Tiny pub/sub for in-app notification events ─────────────────────────────
// No external dependency needed — this is ~20 lines and covers exactly what we
// need: "a chat notification arrived while the app was open" and "the user
// picked an action (reply / mark-read / opened the chat)".
type InAppEvent =
  | { type: 'received'; data: ChatNotificationData }
  | { type: 'reply'; data: ChatNotificationData; text: string }
  | { type: 'markRead'; data: ChatNotificationData }
  | { type: 'open'; data: ChatNotificationData };

type InAppListener = (event: InAppEvent) => void;

class InAppNotificationEmitterImpl {
  private listeners: InAppListener[] = [];

  subscribe(listener: InAppListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  emit(event: InAppEvent) {
    this.listeners.forEach(l => {
      try {
        l(event);
      } catch (e) {
        console.error('InAppNotificationEmitter listener error:', e);
      }
    });
  }
}

export const InAppNotificationEmitter = new InAppNotificationEmitterImpl();

// ── Notification handler ─────────────────────────────────────────────────────
// shouldShowAlert stays true so the OS still shows something if our own banner
// isn't mounted on a given screen; the banner additionally intercepts via the
// 'received' listener below for richer in-app UI.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ── Setup: permissions, channels, categories ────────────────────────────────
export const setupNotifications = async () => {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      console.log('Notification permissions not granted');
      return false;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('chat', {
        name: 'Chat Messages',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6B9D',
        enableVibrate: true,
        enableLights: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
      });

      await Notifications.setNotificationChannelAsync('chat_actions', {
        name: 'Chat Actions',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6B9D',
        enableVibrate: true,
        enableLights: true,
      });
    }

    await registerChatNotificationCategory();

    console.log('Notifications setup complete');
    return true;
  } catch (error) {
    console.error('Failed to setup notifications:', error);
    return false;
  }
};

// ── Register the "chat_message" category with Reply + Mark as Read actions ──
async function registerChatNotificationCategory() {
  try {
    await Notifications.setNotificationCategoryAsync(CHAT_CATEGORY, [
      {
        identifier: ACTION_REPLY,
        buttonTitle: 'Reply',
        textInput: {
          submitButtonTitle: 'Send',
          placeholder: 'Type a reply...',
        },
        options: {
          // Keeping the app backgrounded on iOS is what lets a true inline
          // reply work; on Android this is mostly moot since the OS handles
          // the inline text box itself either way.
          opensAppToForeground: false,
        },
      },
      {
        identifier: ACTION_MARK_READ,
        buttonTitle: 'Mark as Read',
        options: {
          isDestructive: false,
          opensAppToForeground: false,
        },
      },
    ]);
  } catch (error) {
    console.error('Failed to register chat notification category:', error);
  }
}

// ── Push token registration (unchanged behavior) ────────────────────────────
export const getExpoPushToken = async (): Promise<string | null> => {
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn('No project ID found. Run: eas build:configure');
      return null;
    }

    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log('Expo push token:', token.data);
    return token.data;
  } catch (error) {
    console.error('Failed to get push token:', error);
    return null;
  }
};

export const registerPushToken = async (userId: string) => {
  try {
    const token = await getExpoPushToken();
    if (!token) return null;

    const deviceId = await AsyncStorage.getItem('deviceId') || 'unknown';

    const { error } = await supabase
      .from('push_tokens')
      .upsert({
        user_id: userId,
        device_id: deviceId,
        expo_token: token,
        platform: Platform.OS,
        app_version: Constants.expoConfig?.version || 'unknown',
        last_active: new Date().toISOString(),
        is_active: true,
      }, {
        onConflict: 'user_id',
      });

    if (error) {
      console.error('Failed to register push token:', error);
      return null;
    }

    console.log('Push token registered for user:', userId);
    return token;
  } catch (error) {
    console.error('Failed to register push token:', error);
    return null;
  }
};

// ── Send a push notification (now carries categoryIdentifier for actions) ──
export const sendPushNotification = async (
  expoToken: string,
  title: string,
  body: string,
  data: any = {},
  categoryIdentifier?: string
) => {
  try {
    if (!expoToken) {
      console.warn('No expo token provided');
      return false;
    }

    const message = {
      to: expoToken,
      title,
      body,
      sound: 'default',
      badge: 1,
      categoryId: categoryIdentifier, // Expo push service maps this to iOS categoryIdentifier / Android category
      data: {
        type: 'chat_message',
        ...data,
      },
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();

    if (result.data?.status === 'ok') {
      console.log('Push notification sent successfully');
      return true;
    } else {
      console.error('Push notification failed:', result.errors);
      return false;
    }
  } catch (error) {
    console.error('Failed to send push notification:', error);
    return false;
  }
};

// ── Send a chat notification — now tagged with the chat_message category ──
export const sendChatNotification = async (
  senderId: string,
  receiverId: string,
  title: string,
  body: string,
  data: ChatNotificationData | Record<string, any> = {}
) => {
  try {
    const { data: tokenData, error } = await supabase
      .from('push_tokens')
      .select('expo_token')
      .eq('user_id', receiverId)
      .order('last_active', { ascending: false })
      .limit(1)
      .single();

    if (error || !tokenData?.expo_token) {
      console.log('No push token found for user:', receiverId);
      return false;
    }

    return await sendPushNotification(
      tokenData.expo_token,
      title,
      body,
      { senderId, receiverId, ...data },
      CHAT_CATEGORY
    );
  } catch (error) {
    console.error('Failed to send chat notification:', error);
    return false;
  }
};

export const scheduleLocalNotification = async (
  title: string,
  body: string,
  data: any = {},
  seconds: number = 1,
  categoryIdentifier?: string
) => {
  try {
    const trigger: any = { seconds };

    if (Platform.OS === 'android') {
      trigger.channelId = 'chat';
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        badge: 1,
        data,
        categoryIdentifier,
      },
      trigger,
    });

    console.log('Local notification scheduled');
    return true;
  } catch (error) {
    console.error('Failed to schedule local notification:', error);
    return false;
  }
};

// ── Quick actions: mark as read / send a reply from a notification ─────────
// These are the actual server-side effects triggered by either the native
// category action OR the in-app banner — same functions, same code path,
// so behavior is identical regardless of which UI triggered it.

// Supabase's uuid columns reject anything that isn't a real UUID with a fairly
// opaque Postgres error (22P02). Guarding here turns "invalid input syntax for
// type uuid" into a message that actually says which field and value is wrong
// — usually a leftover placeholder like "current-user-id" from a test call
// instead of the real signed-in user's id / chat id.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(value: string | undefined | null, fieldName: string): string {
  if (!value || !UUID_RE.test(value)) {
    throw new Error(
      `${fieldName} must be a real UUID, got ${JSON.stringify(value)}. ` +
      `This usually means a placeholder string (e.g. "current-user-id") was passed ` +
      `instead of the actual id — check wherever this function was called from.`
    );
  }
  return value;
}

export const markChatMessageRead = async (data: ChatNotificationData) => {
  try {
    if (data.messageId) {
      assertUuid(data.messageId, 'data.messageId');
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('id', data.messageId);
    } else if (data.chatId) {
      assertUuid(data.chatId, 'data.chatId');
      assertUuid(data.senderId, 'data.senderId');
      // No specific message id available — mark the whole chat's incoming
      // messages as read, same as opening the chat would.
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('chat_id', data.chatId)
        .eq('sender_id', data.senderId)
        .is('read_at', null);
    }
    return true;
  } catch (error) {
    console.error('markChatMessageRead error:', error);
    return false;
  }
};

export const sendQuickReply = async (
  currentUserId: string,
  data: ChatNotificationData,
  text: string
) => {
  if (!text.trim() || !data.chatId) return false;

  try {
    assertUuid(currentUserId, 'currentUserId');
    assertUuid(data.chatId, 'data.chatId');

    const { error } = await supabase.from('messages').insert({
      chat_id: data.chatId,
      sender_id: currentUserId,
      text: text.trim(),
      created_at: new Date().toISOString(),
      delivered_at: null,
      read_at: null,
    });

    if (error) throw error;

    await supabase
      .from('chats')
      .update({ last_message: text.trim(), last_message_time: new Date().toISOString() })
      .eq('id', data.chatId);

    // Mark the message we're replying to as read too — replying implies seen.
    await markChatMessageRead(data);

    return true;
  } catch (error) {
    console.error('sendQuickReply error:', error);
    return false;
  }
};

// ── Listeners ─────────────────────────────────────────────────────────────────
// onMessagePress fires for the default tap (open the chat). Reply and
// Mark-as-Read are handled here directly so they work identically whether
// triggered from a real push notification's action buttons or replayed by
// the in-app banner.
export const addNotificationListeners = (
  currentUserId: string,
  onMessagePress: (data: ChatNotificationData) => void
) => {
  // Fires when a notification arrives while the app is foregrounded.
  // We forward it into the in-app emitter so a banner component can render it
  // immediately — this is the reliable path the in-app Reply UI depends on.
  // We ALSO log it into NotificationStore so it shows up in the Notifications
  // tab even if no banner happened to be mounted to catch the live event.
  const notificationListener = Notifications.addNotificationReceivedListener(
    (notification) => {
      const data = notification.request.content.data as unknown as ChatNotificationData;
      console.log('Notification received:', data);
      if (data?.type === 'chat_message' && data.chatId) {
        InAppNotificationEmitter.emit({ type: 'received', data });
        logChatNotification({
          chatId: data.chatId,
          senderId: data.senderId,
          senderName: data.senderName,
          senderAvatar: data.senderAvatar,
          messageId: data.messageId,
          preview: data.preview || notification.request.content.body || 'Sent you a message',
        }).catch((e) => console.error('logChatNotification error:', e));
      }
    }
  );

  // Fires when the user interacts with a notification — taps it, taps an
  // action button, or (iOS) submits the native reply text field.
  const responseListener = Notifications.addNotificationResponseReceivedListener(
    async (response) => {
      const data = response.notification.request.content.data as unknown as ChatNotificationData;
      const actionId = response.actionIdentifier;
      console.log('User interacted with notification:', actionId, data);

      if (!data || data.type !== 'chat_message') return;

      // Find the matching store entry (by messageId if we have one) so we can
      // keep its read/unread state in sync with whatever action was taken.
      const markStoreEntryRead = async () => {
        if (!data.messageId) return;
        const all = await NotificationStore.getAll();
        const match = all.find(n => n.messageId === data.messageId);
        if (match) await NotificationStore.markRead(match.id);
      };

      if (actionId === ACTION_MARK_READ) {
        await markChatMessageRead(data);
        await markStoreEntryRead();
        InAppNotificationEmitter.emit({ type: 'markRead', data });
        return;
      }

      if (actionId === ACTION_REPLY) {
        // KNOWN PLATFORM ISSUE: response.userText has been reported to come
        // back as the placeholder string (or undefined) instead of the real
        // typed text on some iOS/Android + expo-notifications combinations
        // (see file header). We send it through if present and non-empty —
        // if it doesn't work reliably on your test devices, that's this bug,
        // not a problem with this code. The in-app banner's reply input does
        // not have this issue since it's a normal React Native TextInput.
        const typed = (response as any).userText as string | undefined;
        if (typed && typed.trim() && typed.trim() !== 'Type a reply...') {
          await sendQuickReply(currentUserId, data, typed);
          await markStoreEntryRead();
        }
        InAppNotificationEmitter.emit({ type: 'reply', data, text: typed ?? '' });
        return;
      }

      if (actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
        await markStoreEntryRead();
        InAppNotificationEmitter.emit({ type: 'open', data });
        onMessagePress(data);
      }
    }
  );

  return () => {
    Notifications.removeNotificationSubscription(notificationListener);
    Notifications.removeNotificationSubscription(responseListener);
  };
};

export const getScheduledNotifications = async () => {
  return await Notifications.getAllScheduledNotificationsAsync();
};

export const cancelAllNotifications = async () => {
  await Notifications.cancelAllScheduledNotificationsAsync();
  console.log('All notifications cancelled');
};
