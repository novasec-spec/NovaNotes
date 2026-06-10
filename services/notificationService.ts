// services/notificationService.ts
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export class NotificationService {
  private static instance: NotificationService;
  private isInitialized: boolean = false;
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService('');
    }
    return NotificationService.instance;
  }

  // ──────────────────────────────────────────────────────────────
  // 1. Setup notifications with action categories
  // ──────────────────────────────────────────────────────────────
  async setupNotifications(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('❌ Notification permissions not granted');
        return false;
      }

      // Create notification channel for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('love_channel', {
          name: 'Love Notifications',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF6B9D',
          enableVibrate: true,
          enableLights: true,
        });
        console.log('✅ Android notification channel created');
      }

      // ============================================================
      // REGISTER NOTIFICATION ACTION CATEGORIES (BUTTONS)
      // ============================================================

      // Category 1: Love Message with "Reply" and "Dismiss" buttons
      await Notifications.setNotificationCategoryAsync('love_message', [
        {
          identifier: 'REPLY',
          buttonTitle: '💌 Reply',
          options: {
            opensAppToForeground: true,  // Opens app when tapped
          },
        },
        {
          identifier: 'HEART',
          buttonTitle: '❤️ Send Love',
          options: {
            opensAppToForeground: false, // Doesn't open app, just sends reaction
          },
        },
        {
          identifier: 'DISMISS',
          buttonTitle: 'Later',
          options: {
            isDestructive: true,  // Makes the button red/destructive styling
          },
        },
      ]);

      // Category 2: Memory Reminder with "View" and "Remind Later" buttons
      await Notifications.setNotificationCategoryAsync('memory_reminder', [
        {
          identifier: 'VIEW_MEMORY',
          buttonTitle: '📸 View Memory',
          options: {
            opensAppToForeground: true,
          },
        },
        {
          identifier: 'REMIND_LATER',
          buttonTitle: '⏰ Remind in 1 hour',
          options: {
            opensAppToForeground: false,
          },
        },
        {
          identifier: 'DISMISS',
          buttonTitle: 'Dismiss',
          options: {
            isDestructive: true,
          },
        },
      ]);

      // Category 3: Mood Check-in with mood selection buttons
      await Notifications.setNotificationCategoryAsync('mood_check', [
        {
          identifier: 'MOOD_HAPPY',
          buttonTitle: '😊 Happy',
          options: {
            opensAppToForeground: false,
          },
        },
        {
          identifier: 'MOOD_LOVED',
          buttonTitle: '🥰 Loved',
          options: {
            opensAppToForeground: false,
          },
        },
        {
          identifier: 'MOOD_SAD',
          buttonTitle: '😢 Sad',
          options: {
            opensAppToForeground: false,
          },
        },
        {
          identifier: 'OPEN_APP',
          buttonTitle: 'Open App',
          options: {
            opensAppToForeground: true,
          },
        },
      ]);

      // Category 4: Note Reminder with "Read" and "Snooze" buttons
      await Notifications.setNotificationCategoryAsync('note_reminder', [
        {
          identifier: 'READ_NOTE',
          buttonTitle: '📖 Read Note',
          options: {
            opensAppToForeground: true,
          },
        },
        {
          identifier: 'SNOOZE',
          buttonTitle: '⏰ Snooze 30min',
          options: {
            opensAppToForeground: false,
          },
        },
        {
          identifier: 'DISMISS',
          buttonTitle: 'Dismiss',
          options: {
            isDestructive: true,
          },
        },
      ]);

      console.log('✅ Notification action categories registered');
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('❌ Notification setup failed:', error);
      return false;
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 2. Send notification with category (buttons will appear)
  // ──────────────────────────────────────────────────────────────
  async sendNotificationWithButtons(
    title: string,
    body: string,
    categoryIdentifier: 'love_message' | 'memory_reminder' | 'mood_check' | 'note_reminder',
    data?: any
  ): Promise<boolean> {
    try {
      // For immediate notification
      const trigger = Platform.OS === 'android'
        ? { seconds: 1, channelId: 'love_channel' }
        : null;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: title,
          body: body,
          sound: true,
          categoryIdentifier: categoryIdentifier, // ← This attaches the buttons!
          data: {
            type: categoryIdentifier,
            ...data,
          },
        },
        trigger: trigger,
      });

      console.log(`✅ Notification with buttons (${categoryIdentifier}) sent`);
      return true;
    } catch (error) {
      console.error('❌ Failed to send notification:', error);
      return false;
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 3. Schedule daily love message with buttons
  // ──────────────────────────────────────────────────────────────
  async scheduleDailyLoveMessage(): Promise<boolean> {
    try {
      const trigger: any = {
        hour: 9,
        minute: 0,
        repeats: true,
      };
      if (Platform.OS === 'android') {
        trigger.channelId = 'love_channel';
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '💕 Good Morning, My Love!',
          body: 'How are you feeling today? Send me some love! 💖',
          sound: true,
          categoryIdentifier: 'love_message', // ← Buttons attached!
          data: { type: 'daily_love' },
        },
        trigger: trigger,
      });

      console.log('✅ Daily love message scheduled');
      return true;
    } catch (error) {
      console.error('❌ Failed to schedule daily love message:', error);
      return false;
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 4. Schedule evening mood check-in with buttons
  // ──────────────────────────────────────────────────────────────
  async scheduleEveningCheckIn(): Promise<boolean> {
    try {
      const trigger: any = {
        hour: 20,
        minute: 0,
        repeats: true,
      };
      if (Platform.OS === 'android') {
        trigger.channelId = 'love_channel';
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🌙 Evening Check-in',
          body: 'How was your day? Tap to share your mood! 💭',
          sound: true,
          categoryIdentifier: 'mood_check', // ← Mood buttons appear!
          data: { type: 'evening_checkin' },
        },
        trigger: trigger,
      });

      console.log('✅ Evening check-in scheduled');
      return true;
    } catch (error) {
      console.error('❌ Failed to schedule evening check-in:', error);
      return false;
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 5. Handle button tap responses
  // ──────────────────────────────────────────────────────────────
  addNotificationListeners() {
    // Listen for when user taps a button on the notification
    const responseListener = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const { actionIdentifier, notification } = response;
        const data = notification.request.content.data;
        const categoryId = notification.request.content.categoryIdentifier;

        console.log('👆 Button tapped:', { actionIdentifier, categoryId, data });

        // Handle different button actions
        switch (actionIdentifier) {
          // Love Message buttons
          case 'REPLY':
            console.log('💌 User wants to reply');
            // You could open the notes screen or show a reply modal
            break;
          case 'HEART':
            console.log('❤️ User sent love reaction');
            // Save reaction to AsyncStorage
            await this.saveReaction('love');
            break;
          
          // Memory Reminder buttons
          case 'VIEW_MEMORY':
            console.log('📸 User wants to view memory');
            // Navigate to memories screen
            break;
          case 'REMIND_LATER':
            console.log('⏰ Remind later requested');
            // Schedule a reminder for 1 hour later
            await this.scheduleReminderLater(data);
            break;
          
          // Mood Check buttons
          case 'MOOD_HAPPY':
            console.log('😊 User is happy');
            await this.saveMood('Happy');
            break;
          case 'MOOD_LOVED':
            console.log('🥰 User feels loved');
            await this.saveMood('Loved');
            break;
          case 'MOOD_SAD':
            console.log('😢 User is sad');
            await this.saveMood('Sad');
            break;
          
          // Note Reminder buttons
          case 'READ_NOTE':
            console.log('📖 User wants to read note');
            break;
          case 'SNOOZE':
            console.log('⏰ Snooze requested');
            await this.scheduleSnooze(data);
            break;
          
          // Dismiss buttons
          case 'DISMISS':
            console.log('User dismissed notification');
            break;
          case 'OPEN_APP':
            console.log('Opening app from button');
            break;
          
          default:
            console.log('Unknown action:', actionIdentifier);
        }
      }
    );

    // Listen for notifications received while app is open
    const notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('📨 Notification received:', notification);
      }
    );

    return () => {
      Notifications.removeNotificationSubscription(responseListener);
      Notifications.removeNotificationSubscription(notificationListener);
    };
  }

  // Helper: Save mood from button tap
  private async saveMood(mood: string) {
    try {
      const history = await AsyncStorage.getItem('moodHistory');
      const moods = history ? JSON.parse(history) : [];
      moods.push({
        mood: mood,
        timestamp: new Date().toISOString(),
        source: 'notification_button',
      });
      await AsyncStorage.setItem('moodHistory', JSON.stringify(moods));
      console.log(`✅ Mood "${mood}" saved from notification`);
    } catch (error) {
      console.error('Failed to save mood:', error);
    }
  }

  // Helper: Save reaction
  private async saveReaction(type: string) {
    try {
      const reactions = await AsyncStorage.getItem('loveReactions');
      const list = reactions ? JSON.parse(reactions) : [];
      list.push({
        type: type,
        timestamp: new Date().toISOString(),
      });
      await AsyncStorage.setItem('loveReactions', JSON.stringify(list));
    } catch (error) {
      console.error('Failed to save reaction:', error);
    }
  }

  // Helper: Schedule a reminder for later
  private async scheduleReminderLater(data: any) {
    try {
      const trigger = Platform.OS === 'android'
        ? { seconds: 3600, channelId: 'love_channel' }  // 1 hour
        : { seconds: 3600 };

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📸 Memory Reminder',
          body: 'You wanted to see this memory again...',
          sound: true,
          categoryIdentifier: 'memory_reminder',
        },
        trigger: trigger,
      });
      console.log('✅ Reminder scheduled for later');
    } catch (error) {
      console.error('Failed to schedule reminder:', error);
    }
  }

  // Helper: Schedule snooze
  private async scheduleSnooze(data: any) {
    try {
      const trigger = Platform.OS === 'android'
        ? { seconds: 1800, channelId: 'love_channel' }  // 30 minutes
        : { seconds: 1800 };

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📖 Note Reminder',
          body: 'Ready to read your note now? ✨',
          sound: true,
          categoryIdentifier: 'note_reminder',
        },
        trigger: trigger,
      });
      console.log('✅ Snooze scheduled');
    } catch (error) {
      console.error('Failed to schedule snooze:', error);
    }
  }
}
