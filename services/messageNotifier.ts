// ─────────────────────────────────────────────────────────────────────────────
//  src/services/messageNotifier.ts
// ─────────────────────────────────────────────────────────────────────────────
//
//  HOW IT WORKS:
//  1. App launches / comes to foreground
//  2. This service reads assets/messages.json (bundled in OTA update)
//  3. Compares the json "version" against last seen version in AsyncStorage
//  4. If version is NEW → loops through messages, fires each unsent one
//     as a local Expo Notification (immediate or delayed)
//  5. Marks each message as sent by saving its ID to AsyncStorage
//  6. Saves the new version number so it never fires twice
//
//  TRIGGER TYPES:
//  "immediate"  → fires right away on launch
//  "delay"      → fires after delayMinutes
//  "scheduled"  → fires at a specific ISO datetime (scheduleAt field)
//  "daily"      → fires every day at a specific time (hour + minute fields)
//
// ─────────────────────────────────────────────────────────────────────────────

import * as Notifications from 'expo-notifications';
import AsyncStorage       from '@react-native-async-storage/async-storage';

// ── Storage keys ──────────────────────────────────────────────────────────────
const KEY_LAST_VERSION = 'msg_last_version';
const KEY_SENT_IDS     = 'msg_sent_ids';

// ── Message shape ─────────────────────────────────────────────────────────────
export interface AppMessage {
  id:             string;
  title:          string;
  body:           string;
  triggerType:    'immediate' | 'delay' | 'scheduled' | 'daily';
  sent:           boolean;          // default false in json — used as hint only
  category?:      string;           // love | reminder | surprise | milestone
  // for "delay"
  delayMinutes?:  number;
  // for "scheduled"
  scheduleAt?:    string;           // ISO 8601 e.g. "2025-06-15T08:00:00"
  // for "daily"
  hour?:          number;           // 0–23
  minute?:        number;           // 0–59
}

export interface MessagesPayload {
  version:    number;
  updatedAt:  string;
  messages:   AppMessage[];
}

// ─────────────────────────────────────────────────────────────────────────────
//  Setup — call once on app start (before checkAndFire)
// ─────────────────────────────────────────────────────────────────────────────
export async function setupMessageNotifier(): Promise<void> {
  // Request permission
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    console.warn('[MessageNotifier] Notification permission not granted');
    return;
  }

  // Set handler so notifications show while app is in foreground too
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert:  true,
      shouldPlaySound:  true,
      shouldSetBadge:   false,
    }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main entry — call this on every app launch & foreground resume
// ─────────────────────────────────────────────────────────────────────────────
export async function checkAndFireMessages(): Promise<void> {
  try {
    // 1. Load the bundled json (updated with each OTA push)
    const payload: MessagesPayload = require('../../assets/messages.json');

    // 2. Load last seen version from storage
    const lastVersionStr = await AsyncStorage.getItem(KEY_LAST_VERSION);
    const lastVersion    = lastVersionStr ? parseInt(lastVersionStr, 10) : 0;

    // 3. No new version — nothing to do
    if (payload.version <= lastVersion) {
      console.log(`[MessageNotifier] Version ${payload.version} already processed. Skipping.`);
      return;
    }

    console.log(`[MessageNotifier] New version ${payload.version} detected (was ${lastVersion}). Processing...`);

    // 4. Load already-sent IDs so we never double-fire
    const sentIdsRaw = await AsyncStorage.getItem(KEY_SENT_IDS);
    const sentIds: string[] = sentIdsRaw ? JSON.parse(sentIdsRaw) : [];

    // 5. Process each message
    const newlySentIds: string[] = [];

    for (const msg of payload.messages) {
      // Skip if already fired in a previous session
      if (sentIds.includes(msg.id)) {
        console.log(`[MessageNotifier] Skipping already-sent: ${msg.id}`);
        continue;
      }

      await scheduleMessage(msg);
      newlySentIds.push(msg.id);
      console.log(`[MessageNotifier] Scheduled: ${msg.id} (${msg.triggerType})`);
    }

    // 6. Persist sent IDs + new version
    const allSentIds = [...sentIds, ...newlySentIds];
    await AsyncStorage.setItem(KEY_SENT_IDS,     JSON.stringify(allSentIds));
    await AsyncStorage.setItem(KEY_LAST_VERSION, String(payload.version));

    console.log(`[MessageNotifier] Done. ${newlySentIds.length} message(s) scheduled.`);

  } catch (err) {
    // Never crash the app over a notification failure
    console.error('[MessageNotifier] Error:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Schedule a single message based on its triggerType
// ─────────────────────────────────────────────────────────────────────────────
async function scheduleMessage(msg: AppMessage): Promise<void> {
  const content = {
    title: msg.title,
    body:  msg.body,
    sound: true,
    data:  { messageId: msg.id, category: msg.category ?? 'love' },
  };

  switch (msg.triggerType) {

    // ── Fire immediately on launch ──────────────────────────────────────────
    case 'immediate': {
      // Small 3-second delay so the app finishes loading first
      await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type:    Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 3,
          repeats: false,
        },
      });
      break;
    }

    // ── Fire after N minutes ────────────────────────────────────────────────
    case 'delay': {
      const minutes = msg.delayMinutes ?? 5;
      await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type:    Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: minutes * 60,
          repeats: false,
        },
      });
      break;
    }

    // ── Fire at a specific date/time ────────────────────────────────────────
    case 'scheduled': {
      if (!msg.scheduleAt) {
        console.warn(`[MessageNotifier] msg ${msg.id} has triggerType "scheduled" but no scheduleAt`);
        break;
      }
      const fireDate = new Date(msg.scheduleAt);
      if (fireDate <= new Date()) {
        // Already past — fire immediately instead of silently dropping
        console.warn(`[MessageNotifier] scheduleAt is in the past for ${msg.id}. Firing immediately.`);
        await Notifications.scheduleNotificationAsync({
          content,
          trigger: {
            type:    Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 3,
            repeats: false,
          },
        });
        break;
      }
      await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type:    Notifications.SchedulableTriggerInputTypes.DATE,
          date:    fireDate,
        },
      });
      break;
    }

    // ── Fire every day at hour:minute ───────────────────────────────────────
    case 'daily': {
      const hour   = msg.hour   ?? 8;
      const minute = msg.minute ?? 0;
      await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type:    Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
          repeats: true,
        },
      });
      break;
    }

    default:
      console.warn(`[MessageNotifier] Unknown triggerType: ${(msg as any).triggerType}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Utility — clear all sent history (useful during dev/testing)
// ─────────────────────────────────────────────────────────────────────────────
export async function resetMessageHistory(): Promise<void> {
  await AsyncStorage.multiRemove([KEY_LAST_VERSION, KEY_SENT_IDS]);
  await Notifications.cancelAllScheduledNotificationsAsync();
  console.log('[MessageNotifier] History reset. All scheduled notifications cancelled.');
}

// ─────────────────────────────────────────────────────────────────────────────
//  Utility — list all currently scheduled notifications (for dev screen)
// ─────────────────────────────────────────────────────────────────────────────
export async function getScheduledNotifications() {
  return await Notifications.getAllScheduledNotificationsAsync();
}
