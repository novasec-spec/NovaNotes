// src/services/notification/NotificationService.ts
//
// ─── WHAT CHANGED IN THIS PASS ────────────────────────────────────────────
// Your logic is 100% preserved (offline queue, scheduled jobs, retries,
// badges, analytics, categories/channels, action handling). On top of that:
//
// 1. FIXED — `getById` was corrupted: it contained a stray INSERT block
//    pasted inside it instead of a SELECT, and referenced variables
//    (`dbType`, `dataWithOriginal`) that don't exist in that method's
//    scope. This would not have compiled. Rewritten as a proper SELECT.
//
// 2. FIXED — Duplicate method name `scheduleNotification`: one public
//    (params object, creates + schedules a notification) and one private
//    (id + date, persists a `scheduled_notifications` row). Same name,
//    different signatures — TypeScript would reject this. Renamed the
//    private one to `persistScheduledMarker`.
//
// 3. FIXED — Dead/lossy `TYPE_MAPPING` in `create()`: it silently
//    downgraded rich types (e.g. `love_actions`, `verse_of_the_day`,
//    `chat_message`) to generic ones (`system`, `chat`) — but every one of
//    those specific values is already allowed by your live
//    `notifications_type_check` constraint, so this was throwing away
//    real information for no reason. It was also *dead code*: the actual
//    insert in `createWithRetry` never used the mapped value, it inserted
//    `params.type` directly. Removed the mapping; the service now trusts
//    the DB constraint as the single source of truth for valid types.
//
// 4. FIXED — `getCountsByType` called `.group('type')`, which doesn't
//    exist on the supabase-js query builder. Replaced with a client-side
//    reduce over the fetched rows.
//
// 5. FIXED — `updateProgress` used `supabase.sql\`...\`` as a value in
//    `.update()`. That tagged-template helper isn't part of the
//    supabase-js client and this would fail at runtime. Replaced with a
//    read-merge-write: fetch the existing `data`, merge the new progress
//    fields client-side, then update.
//
// 6. NEW — `sanitizeNotificationData()`: every payload written to Supabase
//    or handed to `expo-notifications` is now stripped of `undefined`
//    values, functions, and non-JSON-safe fields, and capped in size, so
//    "clean data" holds all the way from creation to the device.
//
// 7. NEW — Notification tap/action wiring: `initialize()` now registers
//    `Notifications.addNotificationResponseReceivedListener`, so tapping a
//    notification (or one of its action buttons) is handled automatically
//    — you don't need to wire that up separately in a screen/hook. Taps
//    are routed through NotificationNavigator, which is guaranteed to
//    resolve to *some* valid screen (see that file for details) so you
//    will never hit "no route found" from a notification tap again.
//
// 8. NEW — `ALL_NOTIFICATION_TYPES` + `isKnownNotificationType()`: a
//    runtime mirror of your DB constraint. `create()` now warns (does not
//    block) if you pass a type outside that list, so drift between your
//    code and the DB constraint surfaces immediately in logs instead of
//    silently failing an insert.

import { createClient } from '@supabase/supabase-js';
import * as Notifications from 'expo-notifications';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppNotification, NotificationData, NotificationType, NotificationCategory } from '../../types/notifications';
import { navigateFromNotification, NotificationRouteData } from './NotificationNavigator';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

// ─── CONFIGURATION ──────────────────────────────────────
const RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 5000,
};

const PROGRESS_THRESHOLDS = [0, 25, 50, 75, 100];

/** Mirrors your live `notifications_type_check` constraint. Keep in sync
 *  if you ever run another migration that changes the allowed values —
 *  this is what powers the drift warning in `create()`. */
export const ALL_NOTIFICATION_TYPES = [
  'reminder', 'system', 'chat', 'task', 'alert', 'progress', 'chat_message',
  'notes', 'mood', 'daily', 'followup', 'love_actions', 'verse_of_the_day',
  'prayer_reminder', 'answered_prayer', 'sermon_reminder', 'praise_reminder',
  'test', 'morning', 'now_playing', 'media', 'night', 'message_actions',
  'task_actions', 'reminder_actions', 'question_actions', 'encouragement',
  'incoming_call', 'call_accepted', 'call_ended', 'call_declined',
  'call_missed', 'call_cancelled',
] as const;

export function isKnownNotificationType(type: string): boolean {
  return (ALL_NOTIFICATION_TYPES as readonly string[]).includes(type);
}

// ─── INTERFACES ─────────────────────────────────────────
interface CreateNotificationParams {
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  data?: NotificationData;
  showLocal?: boolean;
  categoryId?: NotificationCategory;
  priority?: 'low' | 'normal' | 'high';
  scheduledFor?: Date;
  expiresAt?: Date;
}

interface ProgressNotificationParams {
  userId: string;
  title: string;
  body: string;
  total: number;
  current: number;
  data?: Record<string, any>;
}

interface GroupedNotificationParams {
  userId: string;
  groupId: string;
  groupTitle: string;
  items: Array<{ title: string; body: string; data?: any }>;
  categoryId?: NotificationCategory;
}

interface ScheduledNotificationParams {
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  data?: Record<string, any>;
  scheduleDate: Date;
  repeat?: 'daily' | 'weekly' | 'monthly';
}

interface BulkNotificationParams extends CreateNotificationParams {
  userIds: string[];
}

// ─── DATA CLEANING ──────────────────────────────────────
const MAX_DATA_BYTES = 8_000; // generous ceiling; push payload limits are ~4KB total on some platforms

/**
 * Strips undefined/function/symbol values, guarantees JSON-safety, and
 * caps payload size so nothing malformed or oversized ever reaches
 * Supabase or the OS notification tray. Always returns a plain object,
 * never throws.
 */
function sanitizeNotificationData(data: unknown): Record<string, any> {
  if (!data || typeof data !== 'object') return {};

  try {
    // JSON round-trip drops undefined/functions/symbols and de-classes
    // any class instances (e.g. Date -> string would need explicit .toISOString()
    // calls upstream, which the rest of this file already does).
    const clean = JSON.parse(JSON.stringify(data));

    const size = JSON.stringify(clean).length;
    if (size > MAX_DATA_BYTES) {
      console.warn(`⚠️ Notification data payload is ${size} bytes (>${MAX_DATA_BYTES}); truncating non-essential fields`);
      // Keep the fields navigation/analytics actually depend on; drop the rest.
      const {
        screen, target, route, params, notificationId, userId, senderId,
        fromUserId, chatId, taskId, reminderId, noteId, memoryId, callId,
        postId, targetId, groupId, category, type,
      } = clean;
      return {
        screen, target, route, params, notificationId, userId, senderId,
        fromUserId, chatId, taskId, reminderId, noteId, memoryId, callId,
        postId, targetId, groupId, category, type,
        _truncated: true,
      };
    }

    return clean;
  } catch (error) {
    console.error('❌ Failed to sanitize notification data, dropping payload:', error);
    return {};
  }
}

/** Normalizes a raw Supabase row into the shape the app expects, defensively. */
function normalizeNotificationRow(row: any): AppNotification {
  return {
    ...row,
    data: sanitizeNotificationData(row?.data),
    read: !!row?.read,
    priority: row?.priority || 'normal',
  } as AppNotification;
}

// ─── SERVICE CLASS ──────────────────────────────────────
export class NotificationService {
  private static instance: NotificationService;
  private table = 'notifications';
  private channels = new Map<string, any>();
  private badgeListeners = new Set<(count: number) => void>();
  private offlineQueue: CreateNotificationParams[] = [];
  private isOnline = true;
  private isProcessingQueue = false;
  private scheduledJobs = new Map<string, any>();
  private pushToken: string | null = null;
  private responseListenerSub: { remove: () => void } | null = null;

  private constructor() {
    this.setupNetworkListeners();
    this.loadOfflineQueue();
    this.initializeScheduledJobs();
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // ─── INITIALIZATION ──────────────────────────────────────

  async initialize(): Promise<string | null> {
    await this.loadOfflineQueue();

    // Set notification handler
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    // Setup Android channels
    if (Platform.OS === 'android') {
      await this.setupAndroidChannels();
    }

    // Setup notification categories with all features
    await this.setupNotificationCategories();

    // Wire up tap/action handling -> navigation. Safe to call multiple
    // times; we remove any previous subscription first.
    this.setupResponseListener();

    // Request permissions
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      console.log('❌ Permission denied');
      return null;
    }

    // Get push token
    const token = await Notifications.getExpoPushTokenAsync();
    this.pushToken = token.data;
    console.log('📱 Push Token:', this.pushToken);

    return this.pushToken;
  }

  /** Tears down listeners. Call from your root layout's cleanup/unmount if it ever remounts the service consumer. */
  teardown() {
    this.responseListenerSub?.remove();
    this.responseListenerSub = null;
  }

  private readonly androidChannelDefs = [
    { id: 'default', name: 'Default', importance: Notifications.AndroidImportance.MAX },
    { id: 'message', name: 'Messages', importance: Notifications.AndroidImportance.HIGH },
    { id: 'task', name: 'Tasks', importance: Notifications.AndroidImportance.HIGH },
    { id: 'reminder', name: 'Reminders', importance: Notifications.AndroidImportance.HIGH },
    { id: 'system', name: 'System', importance: Notifications.AndroidImportance.DEFAULT },
    { id: 'progress', name: 'Progress', importance: Notifications.AndroidImportance.LOW },
    { id: 'alert', name: 'Alerts', importance: Notifications.AndroidImportance.HIGH },
  ];

  private async setupAndroidChannels() {
    for (const channel of this.androidChannelDefs) {
      await Notifications.setNotificationChannelAsync(channel.id, {
        name: channel.name,
        importance: channel.importance,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }
  }

  private async setupNotificationCategories() {
    // ─── MESSAGE CATEGORY WITH INLINE REPLY ──────────────
    await Notifications.setNotificationCategoryAsync('message', [
      {
        identifier: 'reply',
        buttonTitle: 'Reply',
        options: {
          openAppWhenTapped: true,
          isAuthenticationRequired: false,
        },
      },
      {
        identifier: 'reply_inline',
        buttonTitle: 'Quick Reply',
        options: {
          openAppWhenTapped: false,
          isAuthenticationRequired: false,
        },
        textInput: {
          submitButtonTitle: 'Send',
          placeholder: 'Type your reply...',
        },
      },
      {
        identifier: 'mark_read',
        buttonTitle: 'Mark Read',
        options: {
          openAppWhenTapped: false,
        },
      },
      {
        identifier: 'dismiss',
        buttonTitle: 'Dismiss',
        options: {
          isDestructive: true,
          openAppWhenTapped: false,
        },
      },
    ]);

    // ─── TASK CATEGORY ────────────────────────────────────
    await Notifications.setNotificationCategoryAsync('task', [
      {
        identifier: 'complete',
        buttonTitle: '✓ Complete',
        options: {
          openAppWhenTapped: false,
        },
      },
      {
        identifier: 'snooze',
        buttonTitle: 'Snooze',
        options: {
          openAppWhenTapped: false,
        },
      },
      {
        identifier: 'postpone',
        buttonTitle: 'Postpone',
        options: {
          openAppWhenTapped: false,
          isDestructive: false,
        },
      },
    ]);

    // ─── REMINDER CATEGORY ────────────────────────────────
    await Notifications.setNotificationCategoryAsync('reminder', [
      {
        identifier: 'done',
        buttonTitle: 'Done',
        options: {
          openAppWhenTapped: false,
        },
      },
      {
        identifier: 'later',
        buttonTitle: 'Later',
        options: {
          openAppWhenTapped: false,
        },
      },
      {
        identifier: 'snooze_reminder',
        buttonTitle: 'Snooze 15m',
        options: {
          openAppWhenTapped: false,
        },
      },
    ]);

    // ─── SOCIAL CATEGORY ──────────────────────────────────
    await Notifications.setNotificationCategoryAsync('social', [
      {
        identifier: 'like',
        buttonTitle: '❤️ Like',
        options: {
          openAppWhenTapped: false,
        },
      },
      {
        identifier: 'comment',
        buttonTitle: '💬 Comment',
        options: {
          openAppWhenTapped: true,
        },
      },
      {
        identifier: 'share',
        buttonTitle: '↗️ Share',
        options: {
          openAppWhenTapped: false,
        },
      },
    ]);

    console.log('✅ Notification categories with all features set');
  }

  // ─── TAP / ACTION LISTENER ────────────────────────────────

  private setupResponseListener() {
    this.responseListenerSub?.remove();

    this.responseListenerSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const rawData = response.notification.request.content.data as NotificationRouteData;
      const data = sanitizeNotificationData(rawData);
      const actionIdentifier = response.actionIdentifier; // 'expo.modules.notifications.actions.DEFAULT' on a plain tap
      const isDefaultTap = actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER;
      const inlineText = (response as any).userText as string | undefined;

      if (isDefaultTap) {
        // Plain tap on the notification body -> navigate + mark opened.
        if (data.notificationId && data.userId) {
          this.trackOpen(data.notificationId, data.userId).catch((e) =>
            console.error('Failed to track notification open:', e)
          );
        }
        navigateFromNotification(data.type as NotificationType | undefined, data);
      } else {
        // An action button was pressed.
        this.handleAction(actionIdentifier, data, inlineText).catch((e) =>
          console.error('Failed to handle notification action:', e)
        );
      }
    });
  }

  // ─── NETWORK MANAGEMENT ──────────────────────────────────

  private setupNetworkListeners() {
    if (Platform.OS === 'web') {
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.handleOffline());
    }
    // For React Native, we use NetInfo or similar
  }

  private handleOnline() {
    this.isOnline = true;
    this.processOfflineQueue();
    this.initializeScheduledJobs();
  }

  private handleOffline() {
    this.isOnline = false;
  }

  private async processOfflineQueue() {
    if (this.isProcessingQueue || !this.isOnline || this.offlineQueue.length === 0) return;

    this.isProcessingQueue = true;
    console.log(`📦 Processing ${this.offlineQueue.length} queued notifications`);

    while (this.offlineQueue.length > 0) {
      const params = this.offlineQueue.shift();
      if (params) {
        try {
          await this.create(params);
        } catch (error) {
          console.error('Failed to process queued notification:', error);
          this.offlineQueue.unshift(params);
          break;
        }
      }
    }

    this.isProcessingQueue = false;
    await this.saveOfflineQueue();
  }

  private async queueOffline(params: CreateNotificationParams) {
    this.offlineQueue.push(params);
    await this.saveOfflineQueue();
    console.log(`📦 Notification queued (${this.offlineQueue.length} total)`);
  }

  private async saveOfflineQueue() {
    try {
      await AsyncStorage.setItem('offline_notifications', JSON.stringify(this.offlineQueue));
    } catch (error) {
      console.error('Failed to save offline queue:', error);
    }
  }

  private async loadOfflineQueue() {
    try {
      const data = await AsyncStorage.getItem('offline_notifications');
      if (data) {
        this.offlineQueue = JSON.parse(data);
        console.log(`📦 Loaded ${this.offlineQueue.length} queued notifications`);
        this.processOfflineQueue();
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error);
    }
  }

  // ─── SCHEDULED JOBS ──────────────────────────────────────

  private async initializeScheduledJobs() {
    try {
      // Load scheduled jobs from storage
      const data = await AsyncStorage.getItem('scheduled_jobs');
      if (data) {
        const jobs = JSON.parse(data);
        for (const job of jobs) {
          this.scheduleJob(job);
        }
      }
    } catch (error) {
      console.error('Failed to initialize scheduled jobs:', error);
    }
  }

  private async saveScheduledJobs() {
    try {
      const jobs = Array.from(this.scheduledJobs.entries()).map(([id, job]) => ({
        id,
        ...job,
      }));
      await AsyncStorage.setItem('scheduled_jobs', JSON.stringify(jobs));
    } catch (error) {
      console.error('Failed to save scheduled jobs:', error);
    }
  }

  private scheduleJob(job: any) {
    const now = Date.now();
    const delay = new Date(job.scheduleDate).getTime() - now;

    if (delay <= 0) {
      // Execute immediately if past due
      this.executeScheduledJob(job);
      return;
    }

    const timeoutId = setTimeout(() => {
      this.executeScheduledJob(job);
    }, delay);

    this.scheduledJobs.set(job.id, { ...job, timeoutId });
    this.saveScheduledJobs();
  }

  private async executeScheduledJob(job: any) {
    try {
      await this.create({
        userId: job.userId,
        title: job.title,
        body: job.body,
        type: job.type,
        data: job.data,
        showLocal: true,
        categoryId: job.categoryId,
        priority: 'high',
      });

      // Handle repeats
      if (job.repeat) {
        const nextDate = this.getNextRepeatDate(new Date(job.scheduleDate), job.repeat);
        if (nextDate) {
          this.scheduleJob({
            ...job,
            scheduleDate: nextDate.toISOString(),
          });
        }
      }

      this.scheduledJobs.delete(job.id);
      this.saveScheduledJobs();

    } catch (error) {
      console.error('Failed to execute scheduled job:', error);
    }
  }

  private getNextRepeatDate(date: Date, repeat: string): Date | null {
    const next = new Date(date);
    switch (repeat) {
      case 'daily': next.setDate(next.getDate() + 1); break;
      case 'weekly': next.setDate(next.getDate() + 7); break;
      case 'monthly': next.setMonth(next.getMonth() + 1); break;
      default: return null;
    }
    return next;
  }

  async cancelScheduledJob(jobId: string) {
    const job = this.scheduledJobs.get(jobId);
    if (job?.timeoutId) {
      clearTimeout(job.timeoutId);
    }
    this.scheduledJobs.delete(jobId);
    await this.saveScheduledJobs();
  }

  // ─── BADGE MANAGEMENT ──────────────────────────────────────

  onBadgeChange(callback: (count: number) => void) {
    this.badgeListeners.add(callback);
    return () => this.badgeListeners.delete(callback);
  }

  private emitBadge(count: number) {
    this.badgeListeners.forEach(cb => cb(count));
  }

  async updateBadge(userId: string) {
    const count = await this.getUnreadCount(userId);
    this.emitBadge(count);
    return count;
  }

  // ─── CREATE NOTIFICATION ───────────────────────────────────

  async create(params: CreateNotificationParams): Promise<AppNotification | null> {
    try {
      console.log('💾 Creating notification:', params.title);

      if (!isKnownNotificationType(params.type)) {
        // Non-blocking: DB constraint is the real gatekeeper, this just
        // surfaces drift between code and schema early, in your logs.
        console.warn(`⚠️ "${params.type}" is not in ALL_NOTIFICATION_TYPES — insert may be rejected by the DB constraint.`);
      }

      const cleanData = sanitizeNotificationData({
        ...params.data,
        // Always echo these back so a tap on the resulting notification
        // has everything NotificationNavigator + trackOpen need, even if
        // the caller forgot to include them.
        type: params.type,
      });

      // Check if should show based on preferences
      const shouldShow = await this.checkUserPreferences(params.userId, params.categoryId);
      if (!shouldShow) {
        console.log('⏭️ Skipping due to user preferences');
        return null;
      }

      const cleanParams: CreateNotificationParams = { ...params, data: cleanData };

      // Check online status
      if (!this.isOnline) {
        await this.queueOffline(cleanParams);
        return this.createTempNotification(cleanParams);
      }

      // Save to Supabase with retry
      const result = await this.createWithRetry(cleanParams);
      if (!result) {
        throw new Error('Failed to create notification');
      }

      console.log('✅ Saved to Supabase:', result.id);

      // Update badge
      await this.updateBadge(params.userId);

      // Track analytics
      await this.trackAnalytics(result.id, params.userId, 'received', undefined, {
        category: params.categoryId,
        type: params.type,
        priority: params.priority,
      });

      // Show local notification
      if (params.showLocal !== false) {
        await this.showLocalNotification(result, params.categoryId);
      }

      // Schedule if needed
      if (params.scheduledFor) {
        await this.persistScheduledMarker(result.id, params.scheduledFor);
      }

      return result;

    } catch (error) {
      console.error('❌ Create notification error:', error);
      await this.queueOffline(params);
      return null;
    }
  }

  private createTempNotification(params: CreateNotificationParams): AppNotification {
    return {
      id: `temp_${Date.now()}`,
      user_id: params.userId,
      title: params.title,
      body: params.body,
      data: sanitizeNotificationData(params.data),
      created_at: new Date().toISOString(),
      read: false,
      type: params.type,
      priority: params.priority || 'normal',
    } as AppNotification;
  }

  private async createWithRetry(
    params: CreateNotificationParams,
    attempt = 1
  ): Promise<AppNotification | null> {
    try {
      const { data, error } = await supabase
        .from(this.table)
        .insert({
          user_id: params.userId,
          title: params.title,
          body: params.body,
          type: params.type,
          data: sanitizeNotificationData(params.data),
          read: false,
          priority: params.priority || 'normal',
          scheduled_for: params.scheduledFor?.toISOString(),
          expires_at: params.expiresAt?.toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return normalizeNotificationRow(data);

    } catch (error) {
      if (attempt < RETRY_CONFIG.maxAttempts) {
        const delay = Math.min(
          RETRY_CONFIG.baseDelay * Math.pow(2, attempt - 1),
          RETRY_CONFIG.maxDelay
        );
        console.log(`Retry ${attempt}/${RETRY_CONFIG.maxAttempts} in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.createWithRetry(params, attempt + 1);
      }
      throw error;
    }
  }

  private async showLocalNotification(
    notification: AppNotification,
    categoryId?: NotificationCategory
  ) {
    try {
      const channelId = this.getChannelId(categoryId);
      const shouldSound = await this.shouldPlaySound(notification.user_id, categoryId);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.body,
          data: sanitizeNotificationData({
            ...notification.data,
            notificationId: notification.id,
            userId: notification.user_id,
            type: notification.type,
          }),
          categoryIdentifier: categoryId,
          sound: shouldSound,
          badge: await this.getUnreadCount(notification.user_id),
          priority: notification.priority === 'high' ? 'high' : 'default',
          channelId,
        },
        trigger: null,
      });
    } catch (error) {
      console.error('Failed to show local notification:', error);
    }
  }

  private getChannelId(category?: NotificationCategory): string {
    switch (category) {
      case 'message': return 'message';
      case 'task': return 'task';
      case 'reminder': return 'reminder';
      case 'social': return 'message';
      default: return 'default';
    }
  }

  // ─── PROGRESS NOTIFICATIONS ───────────────────────────────

  async sendProgressNotification(params: ProgressNotificationParams): Promise<AppNotification | null> {
    const { userId, title, body, total, current, data } = params;
    const progress = Math.round((current / total) * 100);

    // Only send at specific thresholds
    const shouldSend = PROGRESS_THRESHOLDS.includes(progress);

    if (!shouldSend) {
      console.log(`⏭️ Skipping progress update at ${progress}%`);
      return null;
    }

    const progressBody = `${body} (${progress}%)`;
    const progressData = {
      ...data,
      progress,
      total,
      current,
      isProgress: true,
    };

    const notification = await this.create({
      userId,
      title,
      body: progressBody,
      type: 'progress',
      data: progressData,
      showLocal: true,
      priority: progress === 100 ? 'high' : 'normal',
    });

    // If complete, send completion notification
    if (progress === 100) {
      await this.create({
        userId,
        title: '✅ Complete!',
        body: `${title} completed successfully`,
        type: 'system',
        data: { ...data, completed: true },
        showLocal: true,
        priority: 'high',
      });
    }

    return notification;
  }

  async updateProgress(
    userId: string,
    notificationId: string,
    current: number,
    total: number
  ): Promise<void> {
    const progress = Math.round((current / total) * 100);

    try {
      // Read-merge-write: the supabase-js client doesn't support raw SQL
      // fragments (e.g. `supabase.sql`) as an update value, so we fetch
      // the current `data`, merge client-side, then write the full object.
      const { data: existing, error: fetchError } = await supabase
        .from(this.table)
        .select('data')
        .eq('id', notificationId)
        .single();

      if (fetchError) throw fetchError;

      const mergedData = sanitizeNotificationData({
        ...(existing?.data || {}),
        progress,
        current,
        total,
      });

      await supabase
        .from(this.table)
        .update({
          data: mergedData,
          body: `Progress: ${progress}%`,
        })
        .eq('id', notificationId);

      // Update local notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Updating...',
          body: `Progress: ${progress}%`,
          data: { notificationId },
        },
        trigger: null,
      });

      await this.updateBadge(userId);

    } catch (error) {
      console.error('Failed to update progress:', error);
    }
  }

  // ─── GROUPED NOTIFICATIONS ────────────────────────────────

  async sendGroupedNotification(params: GroupedNotificationParams): Promise<void> {
    const { userId, groupId, groupTitle, items, categoryId } = params;

    if (items.length === 0) return;

    // Check if group already exists
    const existingGroup = await this.getGroupedNotifications(userId, groupId);
    const allItems = [...(existingGroup?.items || []), ...items];

    // Create or update summary notification
    const summary = allItems.length === 1
      ? allItems[0].body
      : `${allItems.length} notifications`;

    // Delete old group notification
    if (existingGroup) {
      await this.delete(existingGroup.id, userId);
    }

    const notification = await this.create({
      userId,
      title: groupTitle,
      body: summary,
      type: 'system',
      data: {
        groupId,
        grouped: true,
        items: allItems.map(item => ({ ...item, data: item.data })),
        count: allItems.length,
      },
      showLocal: true,
      categoryId: categoryId || 'system',
      priority: 'high',
    });

    if (notification) {
      // Save individual items but don't show them
      for (const item of allItems) {
        await this.create({
          userId,
          title: item.title,
          body: item.body,
          type: 'system',
          data: { ...item.data, groupId, suppressed: true },
          showLocal: false,
          categoryId,
        });
      }
    }

    console.log(`📚 Grouped notification sent: ${groupTitle} (${allItems.length} items)`);
  }

  async getGroupedNotifications(userId: string, groupId?: string): Promise<any> {
    try {
      let query = supabase
        .from(this.table)
        .select('*')
        .eq('user_id', userId)
        .eq('read', false)
        .order('created_at', { ascending: false });

      if (groupId) {
        query = query.eq('data->>groupId', groupId);
      }

      const { data } = await query;

      if (!data) return null;

      // Group by groupId
      const groups = data.reduce((acc, item) => {
        const itemGroupId = item.data?.groupId;
        if (itemGroupId) {
          if (!acc[itemGroupId]) acc[itemGroupId] = [];
          acc[itemGroupId].push(item);
        }
        return acc;
      }, {} as Record<string, any[]>);

      if (groupId) {
        return groups[groupId]?.length > 0 ? {
          id: groups[groupId][0]?.id,
          items: groups[groupId],
          count: groups[groupId].length,
        } : null;
      }

      return Object.entries(groups).map(([gid, groupItems]) => ({
        groupId: gid,
        title: (groupItems as any[])[0]?.title || 'Group',
        count: (groupItems as any[]).length,
        items: groupItems,
        latest: (groupItems as any[])[0],
      }));

    } catch (error) {
      console.error('Error getting grouped notifications:', error);
      return null;
    }
  }

  // ─── SCHEDULED NOTIFICATIONS ──────────────────────────────

  async scheduleNotification(params: ScheduledNotificationParams): Promise<AppNotification | null> {
    try {
      // Create notification but don't show yet
      const notification = await this.create({
        userId: params.userId,
        title: params.title,
        body: params.body,
        type: params.type,
        data: params.data,
        showLocal: false,
        scheduledFor: params.scheduleDate,
      });

      if (!notification) return null;

      // Schedule local delivery
      const jobId = `job_${notification.id}`;
      this.scheduleJob({
        id: jobId,
        userId: params.userId,
        title: params.title,
        body: params.body,
        type: params.type,
        data: params.data,
        scheduleDate: params.scheduleDate.toISOString(),
        repeat: params.repeat || null,
        categoryId: this.getCategoryForType(params.type),
      });

      return notification;

    } catch (error) {
      console.error('Failed to schedule notification:', error);
      return null;
    }
  }

  private getCategoryForType(type: NotificationType): NotificationCategory {
    switch (type) {
      case 'chat': return 'message';
      case 'task': return 'task';
      case 'reminder': return 'reminder';
      default: return 'system';
    }
  }

  /** Persists a `scheduled_notifications` marker row. Renamed from the
   *  original `scheduleNotification` (private, id+date signature) which
   *  collided with the public `scheduleNotification(params)` above —
   *  same name, different signature, would not compile. */
  private async persistScheduledMarker(notificationId: string, scheduledFor: Date) {
    try {
      await supabase
        .from('scheduled_notifications')
        .insert({
          notification_id: notificationId,
          scheduled_for: scheduledFor.toISOString(),
          delivered: false,
        });

      console.log(`📅 Scheduled notification for ${scheduledFor}`);

    } catch (error) {
      console.error('Failed to schedule notification:', error);
    }
  }

  // ─── BULK NOTIFICATIONS ────────────────────────────────────

  async sendBulk(params: BulkNotificationParams): Promise<AppNotification[]> {
    const results: AppNotification[] = [];

    for (const userId of params.userIds) {
      const notification = await this.create({
        ...params,
        userId,
      });
      if (notification) {
        results.push(notification);
      }
    }

    console.log(`📤 Sent ${results.length}/${params.userIds.length} bulk notifications`);
    return results;
  }

  // ─── ACTION HANDLING ──────────────────────────────────────

  async handleAction(identifier: string, notificationData: any, text?: string): Promise<void> {
    const notificationId = notificationData?.notificationId;
    const userId = notificationData?.userId;

    if (!userId) {
      console.error('❌ No userId in notification data');
      return;
    }

    console.log('🔘 Action pressed:', identifier, 'for notif:', notificationId);

    try {
      switch (identifier) {
        // ─── MESSAGE ACTIONS ──────────────────────────────
        case 'reply':
          console.log('💬 Reply tapped - opening app');
          this.handleDeepLink(notificationData);
          break;

        case 'reply_inline':
          if (text) {
            console.log('💬 Inline reply:', text);
            await this.handleInlineReply(notificationData, text);
          }
          break;

        case 'mark_read':
          if (notificationId) {
            await this.markAsRead(notificationId, userId);
            console.log('✅ Marked as read');
          }
          break;

        // ─── TASK ACTIONS ──────────────────────────────────
        case 'complete':
          console.log('✅ Task completed');
          if (notificationId) {
            await this.markAsRead(notificationId, userId);
            await this.trackAnalytics(notificationId, userId, 'action', 'complete');
          }
          break;

        case 'snooze':
          console.log('⏰ Snoozed for 10 min');
          await this.handleSnooze(notificationData, 10);
          break;

        case 'postpone':
          console.log('⏰ Postponed for 30 min');
          await this.handleSnooze(notificationData, 30);
          break;

        // ─── REMINDER ACTIONS ──────────────────────────────
        case 'done':
          if (notificationId) {
            await this.markAsRead(notificationId, userId);
            await this.trackAnalytics(notificationId, userId, 'action', 'done');
          }
          break;

        case 'later':
          console.log('⏰ Reminder postponed');
          if (notificationId) {
            await this.trackAnalytics(notificationId, userId, 'action', 'later');
          }
          break;

        case 'snooze_reminder':
          console.log('⏰ Snoozed for 15 min');
          await this.handleSnooze(notificationData, 15);
          break;

        // ─── SOCIAL ACTIONS ──────────────────────────────────
        case 'like':
          console.log('❤️ Liked');
          if (notificationId) {
            await this.handleSocialAction(notificationData, 'like');
            await this.trackAnalytics(notificationId, userId, 'action', 'like');
          }
          break;

        case 'comment':
          console.log('💬 Comment tapped - opening app');
          this.handleDeepLink(notificationData);
          break;

        case 'share':
          console.log('↗️ Share tapped');
          if (notificationId) {
            await this.handleSocialAction(notificationData, 'share');
            await this.trackAnalytics(notificationId, userId, 'action', 'share');
          }
          break;

        // ─── DISMISS ──────────────────────────────────────
        case 'dismiss':
          if (notificationId) {
            await this.delete(notificationId, userId);
            console.log('🗑️ Dismissed');
          }
          break;

        default:
          console.log('Unknown action:', identifier);
      }

      // Track analytics for all actions
      if (notificationId && identifier !== 'reply' && identifier !== 'comment') {
        await this.trackAnalytics(notificationId, userId, 'action', identifier);
      }

    } catch (error) {
      console.error('Error handling action:', error);
      Alert.alert('Error', 'Could not complete action. Please try again.');
    }
  }

  // ─── ACTION HANDLERS ──────────────────────────────────────

  private async handleInlineReply(notificationData: any, replyText: string) {
    const notificationId = notificationData?.notificationId;
    const userId = notificationData?.userId;
    const senderId = notificationData?.senderId || notificationData?.fromUserId;

    if (!userId || !senderId) {
      console.error('❌ Missing user/sender for inline reply');
      return;
    }

    try {
      // Save reply to messages table
      await supabase
        .from('messages')
        .insert({
          sender_id: userId,
          receiver_id: senderId,
          content: replyText,
          type: 'text',
          created_at: new Date().toISOString(),
        });

      // Track analytics
      await this.trackAnalytics(notificationId, userId, 'action', 'inline_reply', { replyText });

      // Notify sender
      const senderName = await this.getUserDisplayName(userId);
      await this.create({
        userId: senderId,
        title: `${senderName} replied`,
        body: replyText,
        type: 'chat',
        data: {
          screen: 'chat',
          params: { userId },
          senderId: userId,
        },
        showLocal: true,
        categoryId: 'message',
        priority: 'high',
      });

      console.log('✅ Inline reply sent successfully');

    } catch (error) {
      console.error('❌ Failed to send inline reply:', error);
    }
  }

  private async handleSnooze(notificationData: any, minutes: number) {
    const notificationId = notificationData?.notificationId;
    const userId = notificationData?.userId;

    if (!userId || !notificationId) return;

    try {
      // Get the original notification
      const notification = await this.getById(notificationId);
      if (notification) {
        // Schedule for X minutes later
        const scheduleDate = new Date(Date.now() + minutes * 60 * 1000);

        await this.scheduleNotification({
          userId,
          title: notification.title,
          body: notification.body,
          type: notification.type,
          data: notification.data,
          scheduleDate,
        });

        // Mark original as read
        await this.markAsRead(notificationId, userId);

        console.log(`✅ Snoozed for ${minutes} minutes`);
      }
    } catch (error) {
      console.error('Error handling snooze:', error);
    }
  }

  private async handleSocialAction(notificationData: any, action: string) {
    const notificationId = notificationData?.notificationId;
    const userId = notificationData?.userId;
    const targetId = notificationData?.targetId || notificationData?.postId;

    if (!userId || !targetId) {
      console.error('❌ Missing data for social action');
      return;
    }

    try {
      // Update social interaction
      await supabase
        .from('social_interactions')
        .insert({
          user_id: userId,
          target_id: targetId,
          action_type: action,
          created_at: new Date().toISOString(),
        });

      console.log(`✅ Social action: ${action} recorded`);

    } catch (error) {
      console.error(`Failed to record social action ${action}:`, error);
    }
  }

  /**
   * Routes a notification tap/action to the right screen. Delegates to
   * NotificationNavigator, which always resolves to a valid, navigable
   * route (see that file) — so this can never leave the user stuck.
   */
  private handleDeepLink(notificationData: any) {
    const type = notificationData?.type;
    console.log('🔗 Deep linking from notification:', type, notificationData);
    navigateFromNotification(type, notificationData || {});
  }

  // ─── USER PREFERENCES ──────────────────────────────────────

  private async checkUserPreferences(
    userId: string,
    categoryId?: NotificationCategory
  ): Promise<boolean> {
    if (!categoryId) return true;

    try {
      const { data } = await supabase
        .from('notification_preferences')
        .select('categories')
        .eq('user_id', userId)
        .single();

      if (data?.categories && data.categories[categoryId]) {
        return data.categories[categoryId].enabled !== false;
      }

      return true; // Default to enabled

    } catch (error) {
      console.error('Error checking preferences:', error);
      return true;
    }
  }

  private async shouldPlaySound(
    userId: string,
    categoryId?: NotificationCategory
  ): Promise<boolean> {
    if (!categoryId) return true;

    try {
      const { data } = await supabase
        .from('notification_preferences')
        .select('categories')
        .eq('user_id', userId)
        .single();

      if (data?.categories && data.categories[categoryId]) {
        return data.categories[categoryId].sound !== false;
      }

      return true; // Default to sound on

    } catch (error) {
      console.error('Error checking sound preference:', error);
      return true;
    }
  }

  // ─── ANALYTICS ─────────────────────────────────────────────

  private async trackAnalytics(
    notificationId: string,
    userId: string,
    action: 'received' | 'opened' | 'dismissed' | 'action',
    actionIdentifier?: string,
    metadata?: Record<string, any>
  ) {
    try {
      await supabase
        .from('notification_analytics')
        .insert({
          notification_id: notificationId,
          user_id: userId,
          action,
          action_identifier: actionIdentifier,
          timestamp: new Date().toISOString(),
          metadata: sanitizeNotificationData(metadata || {}),
        });
    } catch (error) {
      console.error('Failed to track analytics:', error);
    }
  }

  async trackOpen(notificationId: string, userId: string) {
    await this.trackAnalytics(notificationId, userId, 'opened');
    await this.markAsRead(notificationId, userId);
  }

  // ─── HELPER METHODS ──────────────────────────────────────

  private async getUserDisplayName(userId: string): Promise<string> {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', userId)
        .single();
      return data?.display_name || 'User';
    } catch {
      return 'User';
    }
  }

  // ─── CRUD OPERATIONS ─────────────────────────────────────

  /** Fetch a single notification by id. (Previously this method's body
   *  was corrupted with a stray INSERT block and undefined variables —
   *  rewritten as a proper SELECT.) */
  async getById(id: string): Promise<AppNotification | null> {
    try {
      const { data, error } = await supabase
        .from(this.table)
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data ? normalizeNotificationRow(data) : null;
    } catch (error) {
      console.error('Error fetching notification:', error);
      return null;
    }
  }

  async getAll(
    userId: string,
    limit = 50,
    offset = 0,
    filters?: { type?: NotificationType; read?: boolean; category?: NotificationCategory }
  ): Promise<AppNotification[]> {
    try {
      let query = supabase
        .from(this.table)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (filters?.type) {
        query = query.eq('type', filters.type);
      }
      if (filters?.read !== undefined) {
        query = query.eq('read', filters.read);
      }
      if (filters?.category) {
        query = query.eq('data->>category', filters.category);
      }

      const { data, error } = await query
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return (data || []).map(normalizeNotificationRow);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from(this.table)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  async markAsRead(id: string, userId: string): Promise<void> {
    try {
      await supabase
        .from(this.table)
        .update({ read: true })
        .eq('id', id);

      await this.updateBadge(userId);
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }

  async markAllRead(userId: string): Promise<void> {
    try {
      await supabase
        .from(this.table)
        .update({ read: true })
        .eq('user_id', userId);

      this.emitBadge(0);
    } catch (error) {
      console.error('Error marking all read:', error);
    }
  }

  async delete(id: string, userId: string): Promise<void> {
    try {
      await supabase
        .from(this.table)
        .delete()
        .eq('id', id);

      await this.updateBadge(userId);
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }

  async deleteAll(userId: string): Promise<void> {
    try {
      await supabase
        .from(this.table)
        .delete()
        .eq('user_id', userId);

      this.emitBadge(0);
    } catch (error) {
      console.error('Error deleting all notifications:', error);
    }
  }

  async deleteOld(userId: string, days = 30): Promise<void> {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      await supabase
        .from(this.table)
        .delete()
        .eq('user_id', userId)
        .lt('created_at', cutoff.toISOString());

      await this.updateBadge(userId);
    } catch (error) {
      console.error('Error deleting old notifications:', error);
    }
  }

  // ─── REALTIME SUBSCRIPTION ──────────────────────────────

  subscribe(userId: string, onNew: (payload: any) => void) {
    const name = `notifications:${userId}`;

    if (this.channels.has(name)) {
      supabase.removeChannel(this.channels.get(name));
      this.channels.delete(name);
    }

    const channel = supabase
      .channel(name)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: this.table,
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          // Check if notification should be shown based on preferences
          this.checkUserPreferences(userId, payload.new.data?.category)
            .then(shouldShow => {
              if (shouldShow) {
                this.updateBadge(userId);
                onNew(payload);
              }
            });
        }
      )
      .subscribe();

    this.channels.set(name, channel);
    return channel;
  }

  unsubscribe(userId: string) {
    const name = `notifications:${userId}`;
    const ch = this.channels.get(name);
    if (ch) {
      supabase.removeChannel(ch);
      this.channels.delete(name);
    }
  }

  // ─── NOTIFICATION COUNTS BY TYPE ─────────────────────────

  /** (Previously used `.group('type')`, which doesn't exist on the
   *  supabase-js query builder and would have thrown at runtime. Now
   *  fetches unread rows and aggregates client-side.) */
  async getCountsByType(userId: string): Promise<Record<NotificationType, number>> {
    try {
      const { data, error } = await supabase
        .from(this.table)
        .select('type')
        .eq('user_id', userId)
        .eq('read', false);

      if (error) throw error;

      return (data || []).reduce((acc, item) => {
        const key = item.type as NotificationType;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<NotificationType, number>);
    } catch (error) {
      console.error('Error getting counts by type:', error);
      return {} as Record<NotificationType, number>;
    }
  }

  // ─── PUSH TOKEN ──────────────────────────────────────────

  getPushToken(): string | null {
    return this.pushToken;
  }

  async refreshPushToken(): Promise<string | null> {
    const token = await Notifications.getExpoPushTokenAsync();
    this.pushToken = token.data;
    return this.pushToken;
  }
}

// ─── EXPORT SINGLETON ─────────────────────────────────────

export const notificationService = NotificationService.getInstance();
