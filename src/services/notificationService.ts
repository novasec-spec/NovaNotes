// services/notificationService.ts
import * as Notifications from 'expo-notifications';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { supabase } from '../config/supabase';

// ============================================
// 1. Configure Notification Handler (FOREGROUND)
// ============================================
Notifications.setNotificationHandler({
  handleNotification: async (notification) => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ============================================
// 2. Action Button Types
// ============================================
export interface NotificationAction {
  id: string;
  title: string;
  type: 'reply' | 'mark-read' | 'snooze' | 'custom';
}

export interface ScheduledNotification {
  id: string;
  title: string;
  body: string;
  actions?: NotificationAction[];
  trigger: {
    seconds?: number;
    hour?: number;
    minute?: number;
    weekday?: number;
    repeats: boolean;
  };
  data?: any;
}

// ============================================
// 3. Main Notification Service Class
// ============================================
export class NotificationService {
  private static instance: NotificationService;
  private userId: string;
  private expoPushToken: string | null = null;
  private isInitialized: boolean = false;

  private constructor(userId: string) {
    this.userId = userId;
  }

  static getInstance(userId: string): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService(userId);
    }
    return NotificationService.instance;
  }

  // ============================================
  // 4. INITIALIZATION - MUST CALL ON APP START
  // ============================================
  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      console.log('🔧 Initializing notification service...');

      // Step 1: Request permissions
      const permissionStatus = await this.requestPermissions();
      if (!permissionStatus) {
        console.log('❌ Notification permissions denied');
        return false;
      }

      // Step 2: Create notification channels (CRITICAL FOR ANDROID APK)
      if (Platform.OS === 'android') {
        await this.createNotificationChannels();
      }

      // Step 3: Get Expo push token
      await this.getExpoPushToken();

      // Step 4: Register notification categories for action buttons
      await this.registerNotificationCategories();

      this.isInitialized = true;
      console.log('✅ Notification service initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Notification initialization failed:', error);
      return false;
    }
  }

  // ============================================
  // 5. REQUEST PERMISSIONS
  // ============================================
  private async requestPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        Alert.alert(
          'Notifications Disabled',
          'Please enable notifications in settings to receive love messages and reminders.',
          [{ text: 'OK' }]
        );
        return false;
      }

      console.log('✅ Notification permissions granted');
      return true;
    } catch (error) {
      console.error('Permission request failed:', error);
      return false;
    }
  }

  // ============================================
  // 6. CREATE NOTIFICATION CHANNELS (ANDROID ONLY)
  // ============================================
  private async createNotificationChannels(): Promise<void> {
    try {
      // Channel 1: Main love notifications
      await Notifications.setNotificationChannelAsync('love_channel', {
        name: '💕 Love Notifications',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6B9D',
        enableVibrate: true,
        enableLights: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
      });
      console.log('✅ Love channel created');

      // Channel 2: Action button channel
      await Notifications.setNotificationChannelAsync('action_channel', {
        name: '🎯 Action Notifications',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6B9D',
        enableVibrate: true,
        enableLights: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
      console.log('✅ Action channel created');

      // Channel 3: Reminders
      await Notifications.setNotificationChannelAsync('reminder_channel', {
        name: '⏰ Reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        enableVibrate: true,
      });
      console.log('✅ Reminder channel created');
    } catch (error) {
      console.error('Failed to create channels:', error);
    }
  }

  // ============================================
  // 7. REGISTER CATEGORIES (FOR ACTION BUTTONS)
  // ============================================
  private async registerNotificationCategories(): Promise<void> {
    try {
      // Category 1: Love message actions
      await Notifications.setNotificationCategoryAsync('love_actions', [
        {
          identifier: 'REPLY',
          buttonTitle: '💬 Reply',
          options: {
            opensAppToForeground: true,
            isAuthenticationRequired: false,
          },
        },
        {
          identifier: 'LOVE',
          buttonTitle: '❤️ Love It',
          options: {
            opensAppToForeground: true,
            isAuthenticationRequired: false,
          },
        },
        {
          identifier: 'SNOOZE',
          buttonTitle: '⏰ Remind Later',
          options: {
            opensAppToForeground: false,
            isDestructive: false,
          },
        },
      ]);
      console.log('✅ Love actions category registered');

      // Category 2: Question responses
      await Notifications.setNotificationCategoryAsync('question_actions', [
        {
          identifier: 'HAPPY',
          buttonTitle: '😊 Happy',
          options: { opensAppToForeground: true },
        },
        {
          identifier: 'LOVED',
          buttonTitle: '🥰 Loved',
          options: { opensAppToForeground: true },
        },
        {
          identifier: 'SAD',
          buttonTitle: '😢 Sad',
          options: { opensAppToForeground: true },
        },
        {
          identifier: 'ENERGETIC',
          buttonTitle: '⚡ Energetic',
          options: { opensAppToForeground: true },
        },
      ]);
      console.log('✅ Question actions category registered');

      // Category 3: Reminder actions
      await Notifications.setNotificationCategoryAsync('reminder_actions', [
        {
          identifier: 'DONE',
          buttonTitle: '✅ Done',
          options: { opensAppToForeground: true },
        },
        {
          identifier: 'REMIND_1H',
          buttonTitle: '⏰ 1 Hour',
          options: { opensAppToForeground: false },
        },
        {
          identifier: 'REMIND_TMRW',
          buttonTitle: '📅 Tomorrow',
          options: { opensAppToForeground: false },
        },
      ]);
      console.log('✅ Reminder actions category registered');
    } catch (error) {
      console.error('Failed to register categories:', error);
    }
  }

  // ============================================
  // 8. GET EXPO PUSH TOKEN
  // ============================================
  async getExpoPushToken(): Promise<string | null> {
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        console.warn('⚠️ No EAS project ID found');
        return null;
      }

      const token = await Notifications.getExpoPushTokenAsync({ projectId });
      this.expoPushToken = token.data;
      
      // Save to AsyncStorage and Supabase
      await AsyncStorage.setItem('expoToken', token.data);
      await this.saveTokenToSupabase(token.data);
      
      console.log('✅ Expo push token obtained:', token.data.substring(0, 30) + '...');
      return token.data;
    } catch (error) {
      console.error('Failed to get push token:', error);
      return null;
    }
  }

  // ============================================
  // 9. SAVE TOKEN TO SUPABASE
  // ============================================
  private async saveTokenToSupabase(token: string): Promise<void> {
    try {
      const deviceId = await AsyncStorage.getItem('deviceId') || 'unknown';
      
      await supabase.from('push_tokens').upsert({
        user_id: this.userId,
        device_id: deviceId,
        expo_token: token,
        platform: Platform.OS,
        last_active: new Date().toISOString(),
        is_active: true,
      }, { onConflict: 'device_id' });
      
      console.log('✅ Token saved to Supabase');
    } catch (error) {
      console.error('Failed to save token to Supabase:', error);
    }
  }

  // ============================================
  // 10. SEND LOCAL NOTIFICATION (IMMEDIATE)
  // ============================================
  async sendLocalNotification(
    title: string,
    body: string,
    categoryId?: string,
    data?: any
  ): Promise<string | null> {
    try {
      const content: any = {
        title,
        body,
        sound: true,
        badge: 1,
        data: data || { type: 'local', timestamp: Date.now() },
      };

      if (categoryId) {
        content.categoryIdentifier = categoryId;
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content,
        trigger: null, // null = send immediately
      });

      console.log('✅ Local notification sent:', notificationId);
      return notificationId;
    } catch (error) {
      console.error('Failed to send local notification:', error);
      return null;
    }
  }

  // ============================================
  // 11. SEND NOTIFICATION WITH ACTION BUTTONS
  // ============================================
  async sendActionNotification(
    title: string,
    body: string,
    category: 'love_actions' | 'question_actions' | 'reminder_actions',
    data?: any
  ): Promise<string | null> {
    return this.sendLocalNotification(title, body, category, data);
  }

  // ============================================
  // 12. SCHEDULE NOTIFICATION FOR LATER
  // ============================================
  async scheduleNotification(
    title: string,
    body: string,
    secondsFromNow: number,
    categoryId?: string,
    data?: any
  ): Promise<string | null> {
    try {
      const content: any = {
        title,
        body,
        sound: true,
        badge: 1,
        data: data || { type: 'scheduled', scheduledTime: new Date().toISOString() },
      };

      if (categoryId) {
        content.categoryIdentifier = categoryId;
      }

      const trigger: any = {
        seconds: secondsFromNow,
        repeats: false,
      };

      if (Platform.OS === 'android') {
        trigger.channelId = 'love_channel';
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content,
        trigger,
      });

      console.log(`✅ Notification scheduled for ${secondsFromNow} seconds from now`);
      return notificationId;
    } catch (error) {
      console.error('Failed to schedule notification:', error);
      return null;
    }
  }

  // ============================================
  // 13. SCHEDULE DAILY NOTIFICATION
  // ============================================
  async scheduleDailyNotification(
    title: string,
    body: string,
    hour: number,
    minute: number,
    categoryId?: string,
    data?: any
  ): Promise<string | null> {
    try {
      const content: any = {
        title,
        body,
        sound: true,
        badge: 1,
        data: data || { type: 'daily', hour, minute },
      };

      if (categoryId) {
        content.categoryIdentifier = categoryId;
      }

      const trigger: any = {
        hour,
        minute,
        repeats: true,
      };

      if (Platform.OS === 'android') {
        trigger.channelId = 'love_channel';
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content,
        trigger,
      });

      console.log(`✅ Daily notification scheduled for ${hour}:${minute}`);
      return notificationId;
    } catch (error) {
      console.error('Failed to schedule daily notification:', error);
      return null;
    }
  }

  // ============================================
  // 14. SCHEDULE WEEKLY NOTIFICATION
  // ============================================
  async scheduleWeeklyNotification(
    title: string,
    body: string,
    weekday: number, // 1 = Monday, 7 = Sunday
    hour: number,
    minute: number,
    categoryId?: string,
    data?: any
  ): Promise<string | null> {
    try {
      const content: any = {
        title,
        body,
        sound: true,
        badge: 1,
        data: data || { type: 'weekly', weekday },
      };

      if (categoryId) {
        content.categoryIdentifier = categoryId;
      }

      const trigger: any = {
        weekday,
        hour,
        minute,
        repeats: true,
      };

      if (Platform.OS === 'android') {
        trigger.channelId = 'love_channel';
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content,
        trigger,
      });

      const weekdays = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      console.log(`✅ Weekly notification scheduled for ${weekdays[weekday]} at ${hour}:${minute}`);
      return notificationId;
    } catch (error) {
      console.error('Failed to schedule weekly notification:', error);
      return null;
    }
  }

  // ============================================
  // 15. CANCEL ALL NOTIFICATIONS
  // ============================================
  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('🗑️ All notifications cancelled');
  }

  // ============================================
  // 16. GET ALL SCHEDULED NOTIFICATIONS
  // ============================================
  async getAllScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    return await Notifications.getAllScheduledNotificationsAsync();
  }

  // ============================================
  // 17. ADD NOTIFICATION LISTENERS
  // ============================================
  addNotificationListeners() {
    // Listener for when notification is received (app in foreground)
    const notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('📨 Notification received:', notification.request.content);
      }
    );

    // Listener for when user interacts with notification
    const responseListener = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const { actionIdentifier, notification } = response;
        const data = notification.request.content.data;
        
        console.log(`👆 User tapped action: ${actionIdentifier}`, data);

        // Handle different action types
        switch (actionIdentifier) {
          case 'REPLY':
            // Open app to reply screen
            console.log('Opening reply screen...');
            break;
          case 'LOVE':
            console.log('User loved the notification');
            break;
          case 'SNOOZE':
            // Reschedule for 1 hour later
            await this.scheduleNotification(
              '⏰ Reminder',
              'As promised, here\'s your reminder! 💕',
              3600,
              'love_actions'
            );
            break;
          case 'REMIND_1H':
            await this.scheduleNotification(
              '⏰ Reminder',
              'Here\'s your 1-hour reminder!',
              3600,
              'reminder_actions'
            );
            break;
          case 'REMIND_TMRW':
            await this.scheduleNotification(
              '📅 Tomorrow',
              'Here\'s your reminder for tomorrow!',
              86400,
              'reminder_actions'
            );
            break;
          case 'HAPPY':
          case 'LOVED':
          case 'SAD':
          case 'ENERGETIC':
            // Save mood response
            await AsyncStorage.setItem('lastMoodResponse', actionIdentifier);
            console.log(`Mood saved: ${actionIdentifier}`);
            break;
          default:
            console.log('Unknown action:', actionIdentifier);
        }
      }
    );

    // Return cleanup function
    return () => {
      Notifications.removeNotificationSubscription(notificationListener);
      Notifications.removeNotificationSubscription(responseListener);
    };
  }

  // ============================================
  // 18. SEND REMOTE NOTIFICATION (via Expo API)
  // ============================================
  async sendRemoteNotification(
    title: string,
    body: string,
    toToken?: string
  ): Promise<boolean> {
    const targetToken = toToken || this.expoPushToken;
    
    if (!targetToken) {
      console.error('No push token available');
      return false;
    }

    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: targetToken,
          title,
          body,
          sound: 'default',
          badge: 1,
          data: { type: 'remote', from: this.userId },
        }),
      });

      const result = await response.json();
      
      if (result.data?.status === 'ok') {
        console.log('✅ Remote notification sent');
        return true;
      } else {
        console.error('Remote notification failed:', result.errors);
        return false;
      }
    } catch (error) {
      console.error('Failed to send remote notification:', error);
      return false;
    }
  }

  // ============================================
  // 19. PRESET NOTIFICATIONS
  // ============================================
  async sendLoveMessage(): Promise<void> {
    await this.sendActionNotification(
      '💕 Thinking of You!',
      'You crossed my mind and made me smile. Hope you\'re having a beautiful day!',
      'love_actions'
    );
  }

  async sendGoodMorning(): Promise<void> {
    await this.sendActionNotification(
      '🌅 Good Morning Sunshine!',
      'Rise and shine, beautiful! Today is going to be amazing because you\'re in it.',
      'love_actions'
    );
  }

  async sendGoodNight(): Promise<void> {
    await this.sendActionNotification(
      '🌙 Sweet Dreams',
      'May your dreams be as sweet as you are. Good night, my love! 💤',
      'love_actions'
    );
  }

  async sendDailyQuestion(): Promise<void> {
    await this.sendActionNotification(
      '💭 Daily Question',
      'What made you smile today?',
      'question_actions'
    );
  }

  async sendReminder(): Promise<void> {
    await this.sendActionNotification(
      '⏰ Gentle Reminder',
      'Don\'t forget to take a break and do something nice for yourself today.',
      'reminder_actions'
    );
  }

  // ============================================
  // 20. SETUP ALL AUTOMATED NOTIFICATIONS
  // ============================================
  async setupAutomatedNotifications(): Promise<void> {
    // Daily love message at 9 AM
    await this.scheduleDailyNotification(
      '💕 Good Morning, My Love!',
      'Just wanted to be the first to say you\'re amazing today. Have a wonderful day! 🌸',
      9, 0,
      'love_actions'
    );

    // Afternoon check-in at 1 PM
    await this.scheduleDailyNotification(
      '🌤️ Afternoon Check-in',
      'How\'s your day going? Thinking of you! 💭',
      13, 0,
      'question_actions'
    );

    // Evening reflection at 8 PM
    await this.scheduleDailyNotification(
      '🌙 Good Evening',
      'Hope you had a great day. Don\'t forget to update your mood! 💕',
      20, 0,
      'love_actions'
    );

    // Weekly memory flashback on Monday at 10 AM
    await this.scheduleWeeklyNotification(
      '📸 Memory Flashback',
      'Take a moment to remember a beautiful memory from our journey together 💕',
      1, 10, 0,
      'love_actions'
    );

    console.log('✅ All automated notifications scheduled');
  }
}
