// services/notificationService.ts
import * as Notifications from 'expo-notifications';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';

// Define background task name
const BACKGROUND_FETCH_TASK = 'background-notification-check';

// ──────────────────────────────────────────────────────────────────
// 1. Configure notification handler
// ──────────────────────────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async (notification) => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ──────────────────────────────────────────────────────────────────
// 2. Action Types
// ──────────────────────────────────────────────────────────────────
export type NotificationAction = {
  id: string;
  title: string;
  type: 'reply' | 'mark-read' | 'snooze' | 'custom';
};

// ──────────────────────────────────────────────────────────────────
// 3. Main Notification Service
// ──────────────────────────────────────────────────────────────────
export class NotificationService {
  private static instance: NotificationService;
  private userId: string;
  private expoPushToken: string | null = null;

  private constructor(userId: string) {
    this.userId = userId;
  }

  static getInstance(userId: string): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService(userId);
    }
    return NotificationService.instance;
  }

  // ──────────────────────────────────────────────────────────────────
  // 3.1 Setup - Call once on app start
  // ──────────────────────────────────────────────────────────────────
  async setupNotifications(): Promise<boolean> {
    try {
      // Request permissions
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('❌ Notification permissions not granted');
        return false;
      }

      // Create notification channel for Android (REQUIRED for actions)
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('love_channel', {
          name: 'Love Notifications',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF6B9D',
          enableVibrate: true,
          enableLights: true,
        });

        // Create separate channel for action buttons
        await Notifications.setNotificationChannelAsync('action_channel', {
          name: 'Action Notifications',
          importance: Notifications.AndroidImportance.HIGH,
          bypassDnd: true,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
      }

      // Get Expo push token
      await this.getExpoPushToken();
      
      // Setup background task
      await this.setupBackgroundTask();
      
      console.log('✅ Advanced notifications setup complete');
      return true;
    } catch (error) {
      console.error('❌ Notification setup failed:', error);
      return false;
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // 3.2 Get Expo Push Token
  // ──────────────────────────────────────────────────────────────────
  async getExpoPushToken(): Promise<string | null> {
    try {
      const projectId = require('expo-constants').default.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        console.warn('No project ID found');
        return null;
      }

      const token = await Notifications.getExpoPushTokenAsync({ projectId });
      this.expoPushToken = token.data;
      
      // Save token to Supabase
      await this.saveTokenToSupabase(token.data);
      
      console.log('✅ Expo push token obtained:', token.data);
      return token.data;
    } catch (error) {
      console.error('Failed to get push token:', error);
      return null;
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // 3.3 Save token to Supabase
  // ──────────────────────────────────────────────────────────────────
  private async saveTokenToSupabase(token: string) {
    try {
      const deviceId = await AsyncStorage.getItem('deviceId') || 'unknown';
      
      await supabase
        .from('push_tokens')
        .upsert({
          user_id: this.userId,
          device_id: deviceId,
          expo_token: token,
          platform: Platform.OS,
          last_active: new Date().toISOString(),
          is_active: true,
        }, { onConflict: 'device_id' });
      
      console.log('✅ Token saved to Supabase');
    } catch (error) {
      console.error('Failed to save token:', error);
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // 3.4 Send Local Notification with Action Buttons
  // ──────────────────────────────────────────────────────────────────
  async sendActionNotification(
    title: string,
    body: string,
    actions: NotificationAction[],
    data?: any
  ): Promise<string | null> {
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          badge: 1,
          data: { actions: actions.map(a => a.id), ...data },
          categoryIdentifier: 'love_actions',
        },
        trigger: null, // Send immediately
      });

      // Register action categories
      await this.registerNotificationCategories(actions);
      
      console.log('✅ Action notification sent with ID:', notificationId);
      return notificationId;
    } catch (error) {
      console.error('Failed to send action notification:', error);
      return null;
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // 3.5 Register Notification Categories (for action buttons)
  // ──────────────────────────────────────────────────────────────────
  private async registerNotificationCategories(actions: NotificationAction[]) {
    const nativeActions = actions.map(action => ({
      identifier: action.id,
      buttonTitle: action.title,
      options: {
        isDestructive: action.type === 'snooze',
        isAuthenticationRequired: false,
        opensAppToForeground: true,
      },
    }));

    await Notifications.setNotificationCategoryAsync('love_actions', nativeActions);
  }

  // ──────────────────────────────────────────────────────────────────
  // 3.6 Send Interactive Love Message (with reply button)
  // ──────────────────────────────────────────────────────────────────
  async sendInteractiveLoveMessage(): Promise<void> {
    const actions: NotificationAction[] = [
      { id: 'REPLY', title: '💬 Reply', type: 'reply' },
      { id: 'SNOOZE', title: '⏰ Remind me later', type: 'snooze' },
      { id: 'DISMISS', title: '❤️ Got it', type: 'custom' },
    ];
    
    await this.sendActionNotification(
      '💕 Thinking of You!',
      'You crossed my mind and I just had to say... you\'re amazing! How\'s your day going?',
      actions,
      { type: 'love_message', timestamp: Date.now() }
    );
  }

  // ──────────────────────────────────────────────────────────────────
  // 3.7 Send Quiz/Question Notification (multiple choice)
  // ──────────────────────────────────────────────────────────────────
  async sendDailyQuestionNotification(): Promise<void> {
    const questions = [
      { question: 'What made you smile today? 😊', options: ['Memories', 'Friends', 'Work', 'Just because'] },
      { question: 'How are you feeling right now? 💭', options: ['Happy', 'Loved', 'Relaxed', 'Thoughtful'] },
      { question: 'What should we do together soon? 💑', options: ['Movie night', 'Dinner date', 'Walk', 'Cuddle'] },
    ];
    
    const random = questions[Math.floor(Math.random() * questions.length)];
    const actions: NotificationAction[] = random.options.map((opt, idx) => ({
      id: `ANSWER_${idx}`,
      title: opt,
      type: 'custom',
    }));
    
    await this.sendActionNotification(
      '💭 Daily Question',
      random.question,
      actions,
      { type: 'daily_question' }
    );
  }

  // ──────────────────────────────────────────────────────────────────
  // 3.8 Schedule Daily Love Message (with variations)
  // ──────────────────────────────────────────────────────────────────
  async scheduleDailyLoveMessages(): Promise<void> {
    const messages = [
      { title: '🌅 Good Morning Beautiful!', body: 'Today is going to be amazing because you\'re in it. Have a wonderful day, my love! 💕' },
      { title: '☀️ You\'ve Got This!', body: 'Just a reminder that you\'re stronger than any challenge today. I believe in you! 🌟' },
      { title: '💭 Thinking of You', body: 'In the middle of my day, you\'re always on my mind. Hope you\'re smiling! 😊' },
      { title: '🌙 Good Night Sweetheart', body: 'May your dreams be as beautiful as you are. Can\'t wait to see you tomorrow. 😴💤' },
    ];

    // Morning message (9 AM)
    await this.scheduleNotificationWithTrigger({
      title: messages[0].title,
      body: messages[0].body,
      trigger: { hour: 9, minute: 0, repeats: true, channelId: 'love_channel' },
    });

    // Afternoon boost (1 PM)
    await this.scheduleNotificationWithTrigger({
      title: messages[1].title,
      body: messages[1].body,
      trigger: { hour: 13, minute: 0, repeats: true, channelId: 'love_channel' },
    });

    // Afternoon check-in (4 PM with question)
    await this.scheduleNotificationWithTrigger({
      title: '💭 Quick Check-in',
      body: 'How\'s your energy level right now? Tap to share!',
      trigger: { hour: 16, minute: 0, repeats: true, channelId: 'love_channel' },
    });

    // Evening reflection (8 PM)
    await this.scheduleNotificationWithTrigger({
      title: messages[3].title,
      body: messages[3].body,
      trigger: { hour: 20, minute: 0, repeats: true, channelId: 'love_channel' },
    });

    // Surprise random message (between 2-5 PM, not daily)
    await this.scheduleRandomSurprise();
  }

  // ──────────────────────────────────────────────────────────────────
  // 3.9 Schedule Random Surprise Message
  // ──────────────────────────────────────────────────────────────────
  private async scheduleRandomSurprise(): Promise<void> {
    const surpriseMessages = [
      '🎵 This song reminded me of you today!',
      '📸 Found an old photo of us and couldn\'t stop smiling!',
      '💝 You\'re the best thing that ever happened to me.',
      '🎁 I have a surprise for you next time we meet!',
      '☕ Thinking about our coffee dates... best moments ever!',
    ];
    
    const randomMessage = surpriseMessages[Math.floor(Math.random() * surpriseMessages.length)];
    const randomHour = 14 + Math.floor(Math.random() * 4); // 2 PM - 6 PM
    const randomMinute = Math.floor(Math.random() * 60);
    
    await this.scheduleNotificationWithTrigger({
      title: '🎉 Surprise!',
      body: randomMessage,
      trigger: { hour: randomHour, minute: randomMinute, repeats: false, channelId: 'love_channel' },
    });
  }

  // ──────────────────────────────────────────────────────────────────
  // 3.10 Schedule Weekly Memory Flashback
  // ──────────────────────────────────────────────────────────────────
  async scheduleWeeklyFlashback(): Promise<void> {
    // Get random memory from storage
    const memories = await AsyncStorage.getItem('memories');
    if (memories) {
      const memoryList = JSON.parse(memories);
      if (memoryList.length > 0) {
        const randomMemory = memoryList[Math.floor(Math.random() * memoryList.length)];
        
        await this.scheduleNotificationWithTrigger({
          title: '📸 Memory Flashback!',
          body: `Remember this? ${randomMemory.caption || 'A beautiful moment we shared'} 💕`,
          trigger: { 
            weekday: 1, // Monday
            hour: 10, 
            minute: 0, 
            repeats: true, 
            channelId: 'love_channel' 
          },
        });
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // 3.11 Schedule Mood Check-in Reminder
  // ──────────────────────────────────────────────────────────────────
  async scheduleMoodCheckIn(): Promise<void> {
    await this.scheduleNotificationWithTrigger({
      title: '🌱 How are you feeling?',
      body: 'Take a moment to check in with yourself. Your feelings matter! Tap to log your mood 💭',
      trigger: { hour: 19, minute: 30, repeats: true, channelId: 'love_channel' },
    });
  }

  // ──────────────────────────────────────────────────────────────────
  // 3.12 Send Remote Notification from Server (using your token)
  // ──────────────────────────────────────────────────────────────────
  async sendRemoteNotification(title: string, body: string, data?: any): Promise<boolean> {
    if (!this.expoPushToken) {
      console.error('No push token available');
      return false;
    }

    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: this.expoPushToken,
          title,
          body,
          sound: 'default',
          badge: 1,
          data: data || { type: 'remote' },
        }),
      });

      const result = await response.json();
      console.log('✅ Remote notification sent:', result);
      return true;
    } catch (error) {
      console.error('Failed to send remote notification:', error);
      return false;
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // 3.13 Helper: Schedule notification with trigger
  // ──────────────────────────────────────────────────────────────────
  private async scheduleNotificationWithTrigger(params: {
    title: string;
    body: string;
    trigger: any;
    data?: any;
  }): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: params.title,
          body: params.body,
          sound: true,
          data: params.data || {},
        },
        trigger: params.trigger,
      });
      console.log(`✅ Scheduled: ${params.title}`);
    } catch (error) {
      console.error(`Failed to schedule ${params.title}:`, error);
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // 3.14 Setup Background Task for Silent Notifications
  // ──────────────────────────────────────────────────────────────────
  private async setupBackgroundTask() {
    // Define background task
    TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
      try {
        const now = Date.now();
        const lastBackup = await AsyncStorage.getItem('lastBackup');
        
        // Check if backup needed (every 7 days)
        if (lastBackup && now - parseInt(lastBackup) > 7 * 24 * 60 * 60 * 1000) {
          await this.sendLocalBackupReminder();
        }
        
        return BackgroundFetch.BackgroundFetchResult.NewData;
      } catch (error) {
        console.error('Background task failed:', error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    });

    // Register background task (runs every 12 hours)
    await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
      minimumInterval: 12 * 60 * 60, // 12 hours in seconds
      stopOnTerminate: false,
      startOnBoot: true,
    });
  }

  // ──────────────────────────────────────────────────────────────────
  // 3.15 Send Backup Reminder
  // ──────────────────────────────────────────────────────────────────
  private async sendLocalBackupReminder() {
    await this.sendActionNotification(
      '💾 Backup Reminder',
      'It\'s been a week since your last backup. Keep your memories safe!',
      [
        { id: 'BACKUP', title: '💾 Backup Now', type: 'custom' },
        { id: 'REMIND_LATER', title: '⏰ Remind Tomorrow', type: 'snooze' },
      ],
      { type: 'backup_reminder' }
    );
  }

  // ──────────────────────────────────────────────────────────────────
  // 3.16 Add Notification Response Listener
  // ──────────────────────────────────────────────────────────────────
  addNotificationListeners() {
    // Handle user interaction with notifications
    const responseListener = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const { actionIdentifier, notification } = response;
      const data = notification.request.content.data;
      
      console.log(`🔘 User tapped action: ${actionIdentifier}`, data);
      
      // Handle different action types
      switch (actionIdentifier) {
        case 'REPLY':
          // Open app to reply screen
          console.log('Opening reply screen...');
          break;
        case 'SNOOZE':
          // Reschedule for later
          await this.scheduleNotificationWithTrigger({
            title: '⏰ Reminder',
            body: 'As promised, here\'s your reminder! 💕',
            trigger: { seconds: 3600 }, // 1 hour later
          });
          break;
        case 'BACKUP':
          // Trigger backup
          console.log('Initiating backup...');
          break;
        default:
          // Handle custom actions
          if (actionIdentifier.startsWith('ANSWER_')) {
            console.log('User answered daily question');
          }
      }
    });

    // Handle notifications received while app is foreground
    const notificationListener = Notifications.addNotificationReceivedListener((notification) => {
      console.log('📨 Notification received in foreground:', notification);
    });

    return () => {
      Notifications.removeNotificationSubscription(responseListener);
      Notifications.removeNotificationSubscription(notificationListener);
    };
  }

  // ──────────────────────────────────────────────────────────────────
  // 3.17 Cancel All Scheduled Notifications
  // ──────────────────────────────────────────────────────────────────
  async cancelAllScheduledNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('🗑️ All scheduled notifications cancelled');
  }

  // ──────────────────────────────────────────────────────────────────
  // 3.18 Get All Scheduled Notifications (for debugging)
  // ──────────────────────────────────────────────────────────────────
  async getAllScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    return await Notifications.getAllScheduledNotificationsAsync();
  }

  // ──────────────────────────────────────────────────────────────────
  // 3.19 Send Batch Notifications (multiple at once)
  // ──────────────────────────────────────────────────────────────────
  async sendBatchNotifications(notifications: Array<{title: string, body: string, delaySeconds: number}>): Promise<void> {
    for (const notif of notifications) {
      setTimeout(async () => {
        await this.scheduleNotificationWithTrigger({
          title: notif.title,
          body: notif.body,
          trigger: null,
        });
      }, notif.delaySeconds * 1000);
    }
  }
}
