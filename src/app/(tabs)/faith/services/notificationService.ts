// src/app/(tabs)/faith/services/notificationService.ts
import * as Notifications from 'expo-notifications';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../../../config/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface FaithNotification {
  id: string;
  type: 'verse_of_the_day' | 'prayer_reminder' | 'answered_prayer' | 'sermon_reminder' | 'praise_reminder';
  title: string;
  body: string;
  data: any;
  scheduledTime: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationSettings {
  verseOfTheDay: boolean;
  prayerReminder: boolean;
  sermonReminder: boolean;
  praiseReminder: boolean;
  prayerTime: { hour: number; minute: number };
}

// ─── Default Settings ──────────────────────────────────────────────────────
const DEFAULT_SETTINGS: NotificationSettings = {
  verseOfTheDay: true,
  prayerReminder: true,
  sermonReminder: false,
  praiseReminder: false,
  prayerTime: { hour: 6, minute: 0 },
};

const STORAGE_KEYS = {
  FAITH_NOTIFICATIONS: 'faith_notifications',
  FAITH_NOTIFICATION_SETTINGS: 'faith_notification_settings',
  LAST_VERSE_DATE: 'last_verse_date',
};

// ─── Main Service ──────────────────────────────────────────────────────────
export class FaithNotificationService {
  private static instance: FaithNotificationService;
  private notificationListener: any = null;
  private responseListener: any = null;
  private isInitialized: boolean = false;

  private constructor() {}

  static getInstance(): FaithNotificationService {
    if (!FaithNotificationService.instance) {
      FaithNotificationService.instance = new FaithNotificationService();
    }
    return FaithNotificationService.instance;
  }

  // ─── Initialize ──────────────────────────────────────────────────────────
  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Notification permissions not granted');
        return false;
      }

      if (Platform.OS === 'android') {
        await this.createNotificationChannels();
      }

      Notifications.setNotificationHandler({
        handleNotification: async (notification) => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

      this.setupNotificationListeners();
      await this.scheduleDefaultNotifications();
      this.isInitialized = true;

      console.log('✅ Faith notification service initialized');
      return true;
    } catch (error) {
      console.error('❌ Faith notification init error:', error);
      return false;
    }
  }

  // ─── Create Notification Channels ──────────────────────────────────────
  private async createNotificationChannels() {
    await Notifications.setNotificationChannelAsync('faith_verse', {
      name: 'Verse of the Day',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#8B5CF6',
      enableVibrate: true,
      enableLights: true,
    });

    await Notifications.setNotificationChannelAsync('faith_prayer', {
      name: 'Prayer Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#22C55E',
      enableVibrate: true,
      enableLights: true,
    });

    await Notifications.setNotificationChannelAsync('faith_sermon', {
      name: 'Sermon Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F59E0B',
      enableVibrate: true,
    });

    await Notifications.setNotificationChannelAsync('faith_praise', {
      name: 'Praise & Worship',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#22C55E',
      enableVibrate: true,
    });
  }

  // ─── Setup Notification Listeners ──────────────────────────────────────
  private setupNotificationListeners() {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }

    this.notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('📨 Faith notification received:', notification.request.content.data);
        this.saveNotification(notification);
      }
    );

    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const data = response.notification.request.content.data;
        console.log('👆 Faith notification tapped:', data);

        switch (data.type) {
          case 'verse_of_the_day':
            break;
          case 'prayer_reminder':
            break;
          case 'sermon_reminder':
            break;
          case 'praise_reminder':
            break;
          case 'answered_prayer':
            Alert.alert('🙏 Prayer Answered!', data.message || 'Your prayer has been answered!');
            break;
          default:
            break;
        }
      }
    );
  }

  // ─── Get Notification Settings ─────────────────────────────────────────
  async getSettings(): Promise<NotificationSettings> {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.FAITH_NOTIFICATION_SETTINGS);
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
      return DEFAULT_SETTINGS;
    } catch (error) {
      console.error('Error loading settings:', error);
      return DEFAULT_SETTINGS;
    }
  }

  // ─── Save Notification Settings ────────────────────────────────────────
  async saveSettings(settings: Partial<NotificationSettings>): Promise<void> {
    try {
      const current = await this.getSettings();
      const updated = { ...current, ...settings };
      await AsyncStorage.setItem(STORAGE_KEYS.FAITH_NOTIFICATION_SETTINGS, JSON.stringify(updated));
      await this.scheduleDefaultNotifications();
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  // ─── Schedule Default Notifications ────────────────────────────────────
  async scheduleDefaultNotifications(): Promise<void> {
    try {
      const settings = await this.getSettings();

      // Cancel existing scheduled notifications
      await Notifications.cancelAllScheduledNotificationsAsync();

      // Schedule Verse of the Day
      if (settings.verseOfTheDay) {
        await this.scheduleVerseOfTheDay();
      }

      // Schedule Prayer Reminder
      if (settings.prayerReminder) {
        await this.schedulePrayerReminder(settings.prayerTime.hour, settings.prayerTime.minute);
      }

      // Schedule Sermon Reminder (Sunday)
      if (settings.sermonReminder) {
        await this.scheduleSermonReminder();
      }

      // Schedule Praise Reminder
      if (settings.praiseReminder) {
        await this.schedulePraiseReminder();
      }

      console.log('✅ Faith notifications scheduled');
    } catch (error) {
      console.error('Error scheduling notifications:', error);
    }
  }

  // ─── Schedule Verse of the Day ─────────────────────────────────────────
  private async scheduleVerseOfTheDay(): Promise<void> {
    try {
      const trigger: any = {
        hour: 7,
        minute: 0,
        repeats: true,
      };
      
      if (Platform.OS === 'android') {
        trigger.channelId = 'faith_verse';
      }

      // Get a random verse from your local data or API
      const verse = await this.getRandomVerse();

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📖 Verse of the Day',
          body: verse || '"Trust in the Lord with all your heart" — Proverbs 3:5',
          sound: true,
          data: {
            type: 'verse_of_the_day',
            timestamp: Date.now(),
          },
        },
        trigger,
      });

      console.log('✅ Verse of the Day scheduled');
    } catch (error) {
      console.error('Error scheduling verse:', error);
    }
  }

  private async getRandomVerse(): Promise<string> {
    try {
      // You can replace this with your actual Bible API call
      const verses = [
        '"For God so loved the world that he gave his one and only Son" — John 3:16',
        '"The Lord is my shepherd; I shall not want" — Psalm 23:1',
        '"I can do all this through him who gives me strength" — Philippians 4:13',
        '"Be strong and courageous. Do not be afraid" — Joshua 1:9',
        '"Trust in the Lord with all your heart" — Proverbs 3:5',
        '"The peace of God, which transcends all understanding" — Philippians 4:7',
      ];
      return verses[Math.floor(Math.random() * verses.length)];
    } catch {
      return '"Trust in the Lord with all your heart" — Proverbs 3:5';
    }
  }

  // ─── Schedule Prayer Reminder ──────────────────────────────────────────
  private async schedulePrayerReminder(hour: number, minute: number): Promise<void> {
    try {
      const trigger: any = {
        hour,
        minute,
        repeats: true,
      };
      
      if (Platform.OS === 'android') {
        trigger.channelId = 'faith_prayer';
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🙏 Time to Pray',
          body: 'Take a moment to talk to God. He\'s waiting to hear from you 💕',
          sound: true,
          data: { type: 'prayer_reminder', timestamp: Date.now() },
        },
        trigger,
      });

      console.log(`✅ Prayer reminder scheduled for ${hour}:${minute}`);
    } catch (error) {
      console.error('Error scheduling prayer reminder:', error);
    }
  }

  // ─── Schedule Sermon Reminder (Sunday at 9 AM) ────────────────────────
  private async scheduleSermonReminder(): Promise<void> {
    try {
      const trigger: any = {
        weekday: 7,
        hour: 9,
        minute: 0,
        repeats: true,
      };
      
      if (Platform.OS === 'android') {
        trigger.channelId = 'faith_sermon';
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⛪ Time for Church!',
          body: 'It\'s Sunday! Prepare your heart for worship and the Word. 🎵',
          sound: true,
          data: { type: 'sermon_reminder', timestamp: Date.now() },
        },
        trigger,
      });

      console.log('✅ Sermon reminder scheduled for Sunday 9 AM');
    } catch (error) {
      console.error('Error scheduling sermon reminder:', error);
    }
  }

  // ─── Schedule Praise Reminder ──────────────────────────────────────────
  private async schedulePraiseReminder(): Promise<void> {
    try {
      const trigger: any = {
        hour: 12,
        minute: 0,
        repeats: true,
      };
      
      if (Platform.OS === 'android') {
        trigger.channelId = 'faith_praise';
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🎵 Praise Break!',
          body: 'Take a moment to praise God for His goodness and faithfulness! ✨',
          sound: true,
          data: { type: 'praise_reminder', timestamp: Date.now() },
        },
        trigger,
      });

      console.log('✅ Praise reminder scheduled for 12 PM');
    } catch (error) {
      console.error('Error scheduling praise reminder:', error);
    }
  }

  // ─── Send Prayer Answered Notification ─────────────────────────────────
  async sendPrayerAnsweredNotification(prayerTitle: string): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🙏 Prayer Answered!',
          body: `Your prayer "${prayerTitle}" has been answered! Praise God! 🎉`,
          sound: true,
          data: {
            type: 'answered_prayer',
            message: `Prayer "${prayerTitle}" has been answered!`,
            timestamp: Date.now(),
          },
        },
        trigger: null,
      });

      console.log('✅ Prayer answered notification sent');
    } catch (error) {
      console.error('Error sending prayer answer notification:', error);
    }
  }

  // ─── Save Notification to Local Storage ────────────────────────────────
  private async saveNotification(notification: any) {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.FAITH_NOTIFICATIONS);
      const notifications: FaithNotification[] = saved ? JSON.parse(saved) : [];

      const newNotification: FaithNotification = {
        id: Date.now().toString(),
        type: notification.request.content.data?.type || 'system',
        title: notification.request.content.title || 'Faith Notification',
        body: notification.request.content.body || '',
        data: notification.request.content.data || {},
        scheduledTime: new Date().toISOString(),
        read: false,
        createdAt: new Date().toISOString(),
      };

      notifications.unshift(newNotification);

      if (notifications.length > 100) {
        notifications.splice(100);
      }

      await AsyncStorage.setItem(STORAGE_KEYS.FAITH_NOTIFICATIONS, JSON.stringify(notifications));
    } catch (error) {
      console.error('Error saving notification:', error);
    }
  }

  // ─── Get All Notifications ─────────────────────────────────────────────
  async getNotifications(): Promise<FaithNotification[]> {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.FAITH_NOTIFICATIONS);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Error loading notifications:', error);
      return [];
    }
  }

  // ─── Mark Notification as Read ─────────────────────────────────────────
  async markAsRead(id: string): Promise<void> {
    try {
      const notifications = await this.getNotifications();
      const updated = notifications.map(n =>
        n.id === id ? { ...n, read: true } : n
      );
      await AsyncStorage.setItem(STORAGE_KEYS.FAITH_NOTIFICATIONS, JSON.stringify(updated));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  // ─── Get Unread Count ──────────────────────────────────────────────────
  async getUnreadCount(): Promise<number> {
    try {
      const notifications = await this.getNotifications();
      return notifications.filter(n => !n.read).length;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  // ─── Clear All Notifications ───────────────────────────────────────────
  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.FAITH_NOTIFICATIONS);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  }

  // ─── Cleanup ────────────────────────────────────────────────────────────
  cleanup() {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
  }
}

export default FaithNotificationService;
