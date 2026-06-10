// ============================================================
//  Bubbles — Notification Listener Service
//  File: services/notificationListener.js
//
//  Drop this in your Expo project and call
//  startNotificationListener() from App.js (or layout root).
// ============================================================

import { createClient } from '@supabase/supabase-js';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ── Config ─────────────────────────────────────────────────
const SUPABASE_URL  = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const DEVICE_ID_KEY = '@bubbles/device_id';
const BG_TASK_NAME  = 'BUBBLES_NOTIFICATION_POLL';

// ── Supabase client ────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  realtime: { params: { eventsPerSecond: 10 } },
});

// ── Notification handler (shown while app is foregrounded) ─
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  false,
  }),
});

// ── Helpers ────────────────────────────────────────────────

/** Returns a stable device identifier stored in AsyncStorage. */
async function getDeviceId() {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `device_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/** Request local notification permissions (iOS requires explicit ask). */
async function ensurePermissions() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    console.warn('[Bubbles] Notification permission not granted.');
    return false;
  }

  // Android channel setup
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('bubbles-default', {
      name:       'Bubbles',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 100, 200],
      sound:      'default',
    });
  }
  return true;
}

/**
 * Fire a local notification from a Supabase notification row.
 * Marks it as delivered atomically.
 */
async function dispatchNotification(row) {
  const { id, title, body, data, schedule_at } = row;

  // Build trigger — null means fire immediately
  let trigger = null;
  if (schedule_at) {
    const fireDate = new Date(schedule_at);
    if (fireDate > new Date()) {
      trigger = { date: fireDate };
    }
    // If scheduled time is already past, fire immediately (trigger stays null)
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data:  data ?? {},
      sound: 'default',
    },
    trigger,
  });

  // Mark delivered so it won't fire again
  const { error } = await supabase
    .from('notifications')
    .update({ delivered: true })
    .eq('id', id);

  if (error) {
    console.error('[Bubbles] Failed to mark delivered:', error.message);
  } else {
    console.log(`[Bubbles] Notification delivered: "${title}"`);
  }
}

// ── Strategy A: Supabase Realtime (primary) ────────────────

let realtimeChannel = null;

async function startRealtimeListener() {
  const deviceId = await getDeviceId();

  realtimeChannel = supabase
    .channel('bubbles-notifications')
    .on(
      'postgres_changes',
      {
        event:  'INSERT',
        schema: 'public',
        table:  'notifications',
        // Only rows targeted at this device or broadcast to 'all'
        // (Supabase filter syntax)
        filter: `delivered=eq.false`,
      },
      async (payload) => {
        const row = payload.new;

        // Client-side target check
        if (row.target_device !== 'all' && row.target_device !== deviceId) {
          return;
        }

        await dispatchNotification(row);
      }
    )
    .subscribe((status) => {
      console.log('[Bubbles] Realtime status:', status);
    });
}

function stopRealtimeListener() {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

// ── Strategy B: Background polling fallback ────────────────
//    Fires every ~15 min via expo-background-fetch (iOS minimum).
//    Catches anything missed when the WebSocket was disconnected.

TaskManager.defineTask(BG_TASK_NAME, async () => {
  try {
    await pollAndDeliver();
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (e) {
    console.error('[Bubbles] BG poll error:', e.message);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

async function pollAndDeliver() {
  const deviceId = await getDeviceId();

  const { data: rows, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('delivered', false)
    .or(`target_device.eq.all,target_device.eq.${deviceId}`)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[Bubbles] Poll error:', error.message);
    return;
  }

  for (const row of rows ?? []) {
    await dispatchNotification(row);
  }
}

async function registerBackgroundFetch() {
  try {
    await BackgroundFetch.registerTaskAsync(BG_TASK_NAME, {
      minimumInterval:     15 * 60, // 15 minutes (iOS minimum)
      stopOnTerminate:     false,
      startOnBoot:         true,
    });
    console.log('[Bubbles] Background fetch registered.');
  } catch (e) {
    console.warn('[Bubbles] Background fetch not available:', e.message);
  }
}

// ── Public API ─────────────────────────────────────────────

/**
 * startNotificationListener()
 *
 * Call once from your app root (App.js / _layout.tsx).
 * Sets up:
 *   - Realtime WebSocket subscription (instant delivery)
 *   - Background fetch task (fallback, catches missed events)
 *   - Initial poll on startup (delivers anything queued while offline)
 */
export async function startNotificationListener() {
  const permitted = await ensurePermissions();
  if (!permitted) return;

  // Deliver anything queued while the app was closed
  await pollAndDeliver();

  // Start realtime subscription
  await startRealtimeListener();

  // Register background fallback
  await registerBackgroundFetch();

  console.log('[Bubbles] Notification listener active ✓');
}

/**
 * stopNotificationListener()
 * Call on logout or cleanup.
 */
export async function stopNotificationListener() {
  stopRealtimeListener();
  try {
    await BackgroundFetch.unregisterTaskAsync(BG_TASK_NAME);
  } catch (_) {}
  console.log('[Bubbles] Notification listener stopped.');
}

/**
 * getDeviceIdentifier()
 * Expose device ID so you can target this specific device
 * from the dashboard.
 */
export { getDeviceId as getDeviceIdentifier };
