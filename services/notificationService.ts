// services/notificationService.ts
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ──────────────────────────────────────────────────────────────────
// 1. Configure how notifications behave when app is in foreground
// ──────────────────────────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ──────────────────────────────────────────────────────────────────
// 2. Random messages for weekly nudges
// ──────────────────────────────────────────────────────────────────
const NUDGE_MESSAGES = [
  "You wrote something beautiful — want to re-read it? ✨",
  "A sweet memory is waiting for you! 💕",
  "Your notes miss you. Come say hi! 📝",
  "Something special from the past is calling you 💌",
  "Take a moment to remember something beautiful today 🌸",
];

// ──────────────────────────────────────────────────────────────────
// 3. Main Notification Service Class
// ──────────────────────────────────────────────────────────────────
export class NotificationService {
  private static instance: NotificationService;
  private isInitialized: boolean = false;

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // ──────────────────────────────────────────────────────────────
  // 3.1 Setup - Call this ONCE when app starts
  // ──────────────────────────────────────────────────────────────
  async setupNotifications(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      // Request permissions
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('❌ Notification permissions not granted');
        return false;
      }

      // ✅ CRITICAL FOR ANDROID PRODUCTION APK
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

      this.isInitialized = true;
      console.log('✅ Notifications setup complete');
      return true;
    } catch (error) {
      console.error('❌ Notification setup failed:', error);
      return false;
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 3.2 Build trigger with platform-specific channel ID
  // ──────────────────────────────────────────────────────────────
  private buildTrigger(seconds: number, repeats: boolean = false): any {
    const trigger: any = {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: seconds,
      repeats: repeats,
    };
    
    if (Platform.OS === 'android') {
      trigger.channelId = 'love_channel';
    }
    
    return trigger;
  }

  private buildDailyTrigger(hour: number, minute: number): any {
    const trigger: any = {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: hour,
      minute: minute,
      repeats: true,
    };
    
    if (Platform.OS === 'android') {
      trigger.channelId = 'love_channel';
    }
    
    return trigger;
  }

  // ──────────────────────────────────────────────────────────────
  // 3.3 Send immediate notification
  // ──────────────────────────────────────────────────────────────
  async sendImmediateNotification(title: string, body: string): Promise<boolean> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: title,
          body: body,
          sound: true,
          data: { type: 'immediate' },
        },
        trigger: null, // null = send immediately
      });
      console.log('✅ Immediate notification sent');
      return true;
    } catch (error) {
      console.error('❌ Failed to send immediate notification:', error);
      return false;
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 3.4 Schedule notification after X minutes
  // ──────────────────────────────────────────────────────────────
  async scheduleNoteReminder(
    noteTitle: string, 
    noteText: string, 
    triggerMinutes: number
  ): Promise<boolean> {
    try {
      const preview = noteText.length > 55 
        ? noteText.substring(0, 52) + '...' 
        : noteText;
      
      const trigger = this.buildTrigger(triggerMinutes * 60, false);
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `📝 Note reminder — ${noteTitle || 'Your note'}`,
          body: preview,
          sound: true,
          data: { type: 'note_reminder', noteId: Date.now().toString() },
        },
        trigger: trigger,
      });
      
      console.log(`✅ Note reminder scheduled for ${triggerMinutes} minutes from now`);
      return true;
    } catch (error) {
      console.error('❌ Failed to schedule note reminder:', error);
      return false;
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 3.5 Schedule daily love message
  // ──────────────────────────────────────────────────────────────
  async scheduleDailyLoveMessage(hour: number = 9, minute: number = 0): Promise<boolean> {
    try {
      const trigger = this.buildDailyTrigger(hour, minute);
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '💕 Good Morning, My Love!',
          body: 'Just wanted to be the first to say you\'re amazing today. Hope you have a wonderful day! 🌸',
          sound: true,
          data: { type: 'daily_love' },
        },
        trigger: trigger,
      });
      
      console.log(`✅ Daily love message scheduled for ${hour}:${minute}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to schedule daily love message:', error);
      return false;
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 3.6 Schedule evening check-in
  // ──────────────────────────────────────────────────────────────
  async scheduleEveningCheckIn(hour: number = 20, minute: number = 0): Promise<boolean> {
    try {
      const trigger = this.buildDailyTrigger(hour, minute);
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🌙 How Was Your Day?',
          body: 'Don\'t forget to update your mood and add any special memories from today! 💭',
          sound: true,
          data: { type: 'evening_checkin' },
        },
        trigger: trigger,
      });
      
      console.log(`✅ Evening check-in scheduled for ${hour}:${minute}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to schedule evening check-in:', error);
      return false;
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 3.7 Schedule random weekly nudge to read notes
  // ──────────────────────────────────────────────────────────────
  async scheduleWeeklyNudge(notes: any[]): Promise<boolean> {
    if (!notes || notes.length === 0) {
      console.log('📝 No notes available for nudge scheduling');
      return false;
    }

    try {
      // Check if we already scheduled a nudge this week
      const lastNudge = await AsyncStorage.getItem('lastNudgeDate');
      const now = Date.now();
      
      if (lastNudge && now - parseInt(lastNudge) < 7 * 24 * 60 * 60 * 1000) {
        console.log('⏰ Weekly nudge already sent recently, skipping');
        return false;
      }

      // Pick random note and random delay (2-5 days)
      const randomNote = notes[Math.floor(Math.random() * notes.length)];
      const randomDays = 2 + Math.floor(Math.random() * 4);
      const randomSeconds = randomDays * 24 * 60 * 60;
      const nudgeMsg = NUDGE_MESSAGES[Math.floor(Math.random() * NUDGE_MESSAGES.length)];
      
      const notePreview = randomNote.title 
        ? `"${randomNote.title}" is waiting for you`
        : `"${(randomNote.text ?? '').substring(0, 55)}..."`;

      const trigger = this.buildTrigger(randomSeconds, false);
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: nudgeMsg,
          body: notePreview,
          sound: true,
          data: { type: 'nudge' },
        },
        trigger: trigger,
      });

      await AsyncStorage.setItem('lastNudgeDate', String(now));
      console.log(`✅ Weekly nudge scheduled for ${randomDays} days from now`);
      return true;
    } catch (error) {
      console.error('❌ Failed to schedule weekly nudge:', error);
      return false;
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 3.8 Cancel all scheduled notifications
  // ──────────────────────────────────────────────────────────────
  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('🗑️ All scheduled notifications cancelled');
  }

  // ──────────────────────────────────────────────────────────────
  // 3.9 Add listeners for notification interactions
  // ──────────────────────────────────────────────────────────────
  addNotificationListeners() {
    // When notification is received while app is foreground
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('📨 Notification received:', notification);
    });

    // When user taps on notification
    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('👆 User tapped notification:', response.notification.request.content.data);
      // You can navigate to specific screen based on data.type
    });

    // Return cleanup function
    return () => {
      Notifications.removeNotificationSubscription(notificationListener);
      Notifications.removeNotificationSubscription(responseListener);
    };
  }

  // ──────────────────────────────────────────────────────────────
  // 3.10 Check if notifications are supported
  // ──────────────────────────────────────────────────────────────
  async areNotificationsSupported(): Promise<boolean> {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  }
}
