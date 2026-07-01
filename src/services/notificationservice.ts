import { createClient } from '@supabase/supabase-js';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { AppNotification } from '../types/notifications';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Define action types
export interface NotificationAction {
  identifier: string;
  buttonTitle: string;
  options?: {
    isDestructive?: boolean;
    isAuthenticationRequired?: boolean;
    openAppWhenTapped?: boolean;
  };
}

class NotificationServiceClass {
  private table = 'notifications';
  private channels = new Map<string, any>();
  private badgeListeners: Set<(count: number) => void> = new Set();
  pushToken: string | null = null;

  // ─── BADGE ─────────────────────────────────────────────
  onBadgeChange(callback: (count: number) => void) {
    this.badgeListeners.add(callback);
    return () => this.badgeListeners.delete(callback);
  }

  private emitBadge(count: number) {
    this.badgeListeners.forEach(cb => cb(count));
  }

  // ─── INIT ────────────────────────────────────────────
  async init(): Promise<string | null> {
    // Set handler FIRST
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    // Android channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    // Set up notification categories (action buttons)
    await this.setNotificationCategories();

    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      console.log('❌ Permission denied');
      return null;
    }

    const token = await Notifications.getExpoPushTokenAsync();
    this.pushToken = token.data;
    console.log('📱 Push Token:', this.pushToken);

    return this.pushToken;
  }

  // ─── ACTION BUTTONS SETUP ────────────────────────────
  private async setNotificationCategories() {
    await Notifications.setNotificationCategoryAsync('message', [
      {
        identifier: 'reply',
        buttonTitle: 'Reply',
        options: { openAppWhenTapped: true },
      },
      {
        identifier: 'mark_read',
        buttonTitle: 'Mark Read',
        options: { openAppWhenTapped: false },
      },
      {
        identifier: 'dismiss',
        buttonTitle: 'Dismiss',
        options: { isDestructive: true, openAppWhenTapped: false },
      },
    ]);

    await Notifications.setNotificationCategoryAsync('task', [
      {
        identifier: 'complete',
        buttonTitle: '✓ Complete',
        options: { openAppWhenTapped: false },
      },
      {
        identifier: 'snooze',
        buttonTitle: 'Snooze',
        options: { openAppWhenTapped: false },
      },
    ]);

    await Notifications.setNotificationCategoryAsync('reminder', [
      {
        identifier: 'done',
        buttonTitle: 'Done',
        options: { openAppWhenTapped: false },
      },
      {
        identifier: 'later',
        buttonTitle: 'Later',
        options: { openAppWhenTapped: false },
      },
    ]);

    console.log('✅ Notification categories set');
  }

  // ─── CREATE NOTIFICATION ─────────────────────────────
  async create(params: {
    userId: string;
    title: string;
    body: string;
    type: AppNotification['type'];
    data?: Record<string, any>;
    showLocal?: boolean;
    categoryId?: string; // 'message', 'task', 'reminder'
  }): Promise<AppNotification | null> {
    console.log('💾 Creating notification:', params.title);

    // Save to Supabase
    const { data, error } = await supabase
      .from(this.table)
      .insert({
        user_id: params.userId,
        title: params.title,
        body: params.body,
        type: params.type,
        data: params.data || {},
        read: false,
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Supabase error:', error);
      return null;
    }

    console.log('✅ Saved to Supabase:', data.id);

    // Update badge
    const count = await this.getUnreadCount(params.userId);
    this.emitBadge(count);

    // Show local banner with action buttons
    if (params.showLocal) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: params.title,
          body: params.body,
          data: { ...params.data, notificationId: data.id },
          categoryIdentifier: params.categoryId,
        },
        trigger: null,
      });
    }

    return data;
  }

  // ─── HANDLE ACTION BUTTON PRESS ──────────────────────
  async handleAction(identifier: string, notificationData: any): Promise<void> {
    const notificationId = notificationData?.notificationId;
    const userId = notificationData?.userId;

    console.log('🔘 Action pressed:', identifier, 'for notif:', notificationId);

    switch (identifier) {
      case 'mark_read':
        if (notificationId) {
          await this.markAsRead(notificationId, userId);
          console.log('✅ Marked as read');
        }
        break;

      case 'dismiss':
        if (notificationId) {
          await this.delete(notificationId, userId);
          console.log('🗑️ Dismissed');
        }
        break;

      case 'complete':
        console.log('✅ Task completed');
        // Add your task completion logic here
        if (notificationId) await this.markAsRead(notificationId, userId);
        break;

      case 'snooze':
        console.log('⏰ Snoozed for 10 min');
        // Schedule new notification
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Reminder (Snoozed)',
            body: notificationData?.body || 'Snoozed reminder',
            data: notificationData,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 600, // 10 minutes
          },
        });
        break;

      case 'done':
        if (notificationId) await this.markAsRead(notificationId, userId);
        break;

      case 'later':
        console.log('⏰ Reminder postponed');
        break;

      case 'reply':
        // Opens app - handle in your chat screen
        console.log('💬 Reply tapped - opening app');
        break;

      default:
        console.log('Unknown action:', identifier);
    }
  }

  // ─── GETTERS ─────────────────────────────────────────
  async getAll(userId: string): Promise<AppNotification[]> {
    const { data, error } = await supabase
      .from(this.table)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) { console.error(error); return []; }
    return data || [];
  }

  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from(this.table)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);
    if (error) { console.error(error); return 0; }
    return count || 0;
  }

  async markAsRead(id: string, userId: string): Promise<void> {
    await supabase.from(this.table).update({ read: true }).eq('id', id);
    const count = await this.getUnreadCount(userId);
    this.emitBadge(count);
  }

  async markAllRead(userId: string): Promise<void> {
    await supabase.from(this.table).update({ read: true }).eq('user_id', userId);
    this.emitBadge(0);
  }

  async delete(id: string, userId: string): Promise<void> {
    await supabase.from(this.table).delete().eq('id', id);
    const count = await this.getUnreadCount(userId);
    this.emitBadge(count);
  }

  // ─── REALTIME ────────────────────────────────────────
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
        onNew
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
}

export const notificationService = new NotificationServiceClass();
