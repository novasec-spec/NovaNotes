// ─────────────────────────────────────────────────────────────────────────────
//  src/services/notificationHandler.ts
// ─────────────────────────────────────────────────────────────────────────────
//
//  WHAT THIS DOES:
//  1. Registers all interactive notification categories with action buttons
//  2. Handles what happens when Alice taps a button
//  3. Saves her responses to AsyncStorage (you can read them anytime)
//  4. Shows in-app reaction toasts when she responds
//
//  CATEGORIES:
//  LOVE_NOTE       — love messages from you
//  REMINDER        — task / water / medication reminders
//  MOOD_CHECK      — daily mood check-in
//  MEMORY_REMINDER — resurfaces a shared memory
//  CHECKIN         — "how are you doing?" check
//  SURPRISE        — surprise messages / gifts
//
// ─────────────────────────────────────────────────────────────────────────────

import * as Notifications from 'expo-notifications';
import AsyncStorage       from '@react-native-async-storage/async-storage';

// ── Storage key for all her responses ────────────────────────────────────────
export const KEY_RESPONSES = 'notification_responses';

// ── Response shape ────────────────────────────────────────────────────────────
export interface NotificationResponse {
  id:           string;      // unique response id
  categoryId:   string;      // which category was it
  actionId:     string;      // which button she tapped
  messageTitle: string;      // the notification title
  messageBody:  string;      // the notification body
  textInput?:   string;      // if she typed a reply
  timestamp:    string;      // when she responded
}

// ─────────────────────────────────────────────────────────────────────────────
//  Register all notification categories
//  Call once on app start — safe to call multiple times
// ─────────────────────────────────────────────────────────────────────────────
export async function registerNotificationCategories(): Promise<void> {
  await Notifications.setNotificationCategoryAsync('LOVE_NOTE', [
    {
      identifier: 'LOVE_BACK',
      buttonTitle: '💕 Love you back',
      options: { opensAppToForeground: false },
    },
    {
      identifier: 'KISS_BACK',
      buttonTitle: '😘 Kiss back',
      options: { opensAppToForeground: false },
    },
    {
      identifier: 'REPLY',
      buttonTitle: '💬 Reply',
      options: { opensAppToForeground: true },
      textInput: {
        submitButtonTitle: 'Send',
        placeholder:       'Write back...',
      },
    },
  ]);

  await Notifications.setNotificationCategoryAsync('REMINDER', [
    {
      identifier: 'DONE',
      buttonTitle: '✅ Done!',
      options: { opensAppToForeground: false },
    },
    {
      identifier: 'SNOOZE_15',
      buttonTitle: '⏰ 15 min',
      options: { opensAppToForeground: false },
    },
    {
      identifier: 'SNOOZE_60',
      buttonTitle: '⏰ 1 hour',
      options: { opensAppToForeground: false },
    },
  ]);

  await Notifications.setNotificationCategoryAsync('MOOD_CHECK', [
    {
      identifier: 'MOOD_GREAT',
      buttonTitle: '😊 I\'m great!',
      options: { opensAppToForeground: false },
    },
    {
      identifier: 'MOOD_OKAY',
      buttonTitle: '😐 I\'m okay',
      options: { opensAppToForeground: false },
    },
    {
      identifier: 'MOOD_LOW',
      buttonTitle: '🥺 Not great',
      options: { opensAppToForeground: true },
    },
    {
      identifier: 'MOOD_REPLY',
      buttonTitle: '💬 Tell him',
      options: { opensAppToForeground: true },
      textInput: {
        submitButtonTitle: 'Send',
        placeholder:       'How are you feeling?',
      },
    },
  ]);

  await Notifications.setNotificationCategoryAsync('MEMORY_REMINDER', [
    {
      identifier: 'MEMORY_LOVED',
      buttonTitle: '🥹 I remember this',
      options: { opensAppToForeground: false },
    },
    {
      identifier: 'MEMORY_OPEN',
      buttonTitle: '📸 Open memories',
      options: { opensAppToForeground: true },
    },
    {
      identifier: 'MEMORY_REPLY',
      buttonTitle: '💬 Say something',
      options: { opensAppToForeground: false },
      textInput: {
        submitButtonTitle: 'Send',
        placeholder:       'What does this memory mean to you?',
      },
    },
  ]);

  await Notifications.setNotificationCategoryAsync('CHECKIN', [
    {
      identifier: 'CHECKIN_GOOD',
      buttonTitle: '😊 All good!',
      options: { opensAppToForeground: false },
    },
    {
      identifier: 'CHECKIN_BUSY',
      buttonTitle: '😅 A bit busy',
      options: { opensAppToForeground: false },
    },
    {
      identifier: 'CHECKIN_CALL',
      buttonTitle: '📞 Let\'s call',
      options: { opensAppToForeground: true },
    },
    {
      identifier: 'CHECKIN_REPLY',
      buttonTitle: '💬 Reply',
      options: { opensAppToForeground: false },
      textInput: {
        submitButtonTitle: 'Send',
        placeholder:       'What\'s up?',
      },
    },
  ]);

  await Notifications.setNotificationCategoryAsync('SURPRISE', [
    {
      identifier: 'SURPRISE_LOVED',
      buttonTitle: '🥰 I love this!',
      options: { opensAppToForeground: false },
    },
    {
      identifier: 'SURPRISE_OPEN',
      buttonTitle: '🎁 Open app',
      options: { opensAppToForeground: true },
    },
    {
      identifier: 'SURPRISE_REPLY',
      buttonTitle: '💬 React',
      options: { opensAppToForeground: false },
      textInput: {
        submitButtonTitle: 'Send',
        placeholder:       'Your reaction...',
      },
    },
  ]);

  console.log('[NotificationHandler] All categories registered.');
}

// ─────────────────────────────────────────────────────────────────────────────
//  Setup notification handler + response listener
//  Returns cleanup function — call on unmount
// ─────────────────────────────────────────────────────────────────────────────
export function setupNotificationListeners(
  onResponse?: (response: NotificationResponse) => void
): () => void {

  // Show notifications even when app is in foreground
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert:  true,
      shouldPlaySound:  true,
      shouldSetBadge:   false,
    }),
  });

  // Listen for button taps
  const responseSub = Notifications.addNotificationResponseReceivedListener(
    async (raw) => {
      const categoryId   = raw.notification.request.content.categoryIdentifier ?? '';
      const actionId     = raw.actionIdentifier;
      const messageTitle = raw.notification.request.content.title ?? '';
      const messageBody  = raw.notification.request.content.body  ?? '';
      const textInput    = (raw as any).userText ?? undefined;

      const response: NotificationResponse = {
        id:           `resp_${Date.now()}`,
        categoryId,
        actionId,
        messageTitle,
        messageBody,
        textInput,
        timestamp: new Date().toISOString(),
      };

      // Save response
      await saveResponse(response);

      // Handle snooze actions — re-schedule the notification
      if (actionId === 'SNOOZE_15') {
        await Notifications.scheduleNotificationAsync({
          content: {
            title:              messageTitle,
            body:               messageBody,
            categoryIdentifier: 'REMINDER',
            sound:              true,
          },
          trigger: {
            type:    Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 15 * 60,
            repeats: false,
          },
        });
      }

      if (actionId === 'SNOOZE_60') {
        await Notifications.scheduleNotificationAsync({
          content: {
            title:              messageTitle,
            body:               messageBody,
            categoryIdentifier: 'REMINDER',
            sound:              true,
          },
          trigger: {
            type:    Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 60 * 60,
            repeats: false,
          },
        });
      }

      // Callback to app (e.g. show in-app toast)
      onResponse?.(response);

      console.log('[NotificationHandler] Response received:', response);
    }
  );

  return () => {
    responseSub.remove();
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Save a response to AsyncStorage
// ─────────────────────────────────────────────────────────────────────────────
async function saveResponse(response: NotificationResponse): Promise<void> {
  try {
    const existing = await AsyncStorage.getItem(KEY_RESPONSES);
    const all: NotificationResponse[] = existing ? JSON.parse(existing) : [];
    all.unshift(response); // newest first
    // Keep max 100 responses
    if (all.length > 100) all.splice(100);
    await AsyncStorage.setItem(KEY_RESPONSES, JSON.stringify(all));
  } catch (e) {
    console.error('[NotificationHandler] Failed to save response:', e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Read all saved responses — use in your dev screen or home screen
// ─────────────────────────────────────────────────────────────────────────────
export async function getAllResponses(): Promise<NotificationResponse[]> {
  const raw = await AsyncStorage.getItem(KEY_RESPONSES);
  return raw ? JSON.parse(raw) : [];
}

// Clear all responses
export async function clearAllResponses(): Promise<void> {
  await AsyncStorage.removeItem(KEY_RESPONSES);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Human-readable label for an actionId — use in UI
// ─────────────────────────────────────────────────────────────────────────────
export function actionLabel(actionId: string): string {
  const map: Record<string, string> = {
    LOVE_BACK:       '💕 Loved it back',
    KISS_BACK:       '😘 Kissed back',
    REPLY:           '💬 Replied',
    DONE:            '✅ Marked done',
    SNOOZE_15:       '⏰ Snoozed 15 min',
    SNOOZE_60:       '⏰ Snoozed 1 hour',
    MOOD_GREAT:      '😊 Feeling great',
    MOOD_OKAY:       '😐 Feeling okay',
    MOOD_LOW:        '🥺 Feeling low',
    MOOD_REPLY:      '💬 Shared mood',
    MEMORY_LOVED:    '🥹 Remembered it',
    MEMORY_OPEN:     '📸 Opened memories',
    MEMORY_REPLY:    '💬 Reacted to memory',
    CHECKIN_GOOD:    '😊 All good',
    CHECKIN_BUSY:    '😅 Said she\'s busy',
    CHECKIN_CALL:    '📞 Wants to call',
    CHECKIN_REPLY:   '💬 Replied to check-in',
    SURPRISE_LOVED:  '🥰 Loved the surprise',
    SURPRISE_OPEN:   '🎁 Opened the app',
    SURPRISE_REPLY:  '💬 Reacted to surprise',
  };
  return map[actionId] ?? actionId;
}
