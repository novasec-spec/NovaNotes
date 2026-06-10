// services/NotificationService.ts
import * as Notifications from 'expo-notifications';
import { Platform, AppState } from 'react-native';
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
  private navigationRef: any = null; // For navigation

  constructor(userId: string) {
    this.userId = userId;
  }

  static getInstance(userId?: string): NotificationService {
    if (!NotificationService.instance && userId) {
      NotificationService.instance = new NotificationService(userId);
    }
    return NotificationService.instance;
  }

  // Set navigation reference for deep linking
  setNavigationRef(nav: any) {
    this.navigationRef = nav;
  }

  // ──────────────────────────────────────────────────────────────
  // SETUP NOTIFICATIONS WITH CATEGORIES
  // ──────────────────────────────────────────────────────────────
  async setupNotifications(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('❌ Notification permissions not granted');
        return false;
      }

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
      // REGISTER CATEGORIES WITH BUTTONS
      // ============================================================

      // 1. LOVE MESSAGE CATEGORY - Full interactive
      await Notifications.setNotificationCategoryAsync('love_message', [
        {
          identifier: 'REPLY',
          buttonTitle: '💌 Reply',
          options: {
            opensAppToForeground: true,
          },
        },
        {
          identifier: 'SEND_LOVE',
          buttonTitle: '❤️ Send Love',
          options: {
            opensAppToForeground: false,
          },
        },
        {
          identifier: 'LOVE_LATER',
          buttonTitle: '⏰ Later',
          options: {
            opensAppToForeground: false,
          },
        },
      ]);

      // 2. MEMORY REMINDER CATEGORY
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
          identifier: 'DISMISS_MEMORY',
          buttonTitle: 'Dismiss',
          options: {
            isDestructive: true,
          },
        },
      ]);

      // 3. MOOD CHECK CATEGORY
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
          identifier: 'MOOD_OPEN_APP',
          buttonTitle: 'Open App',
          options: {
            opensAppToForeground: true,
          },
        },
      ]);

      // 4. NOTE REMINDER CATEGORY
      await Notifications.setNotificationCategoryAsync('note_reminder', [
        {
          identifier: 'READ_NOTE',
          buttonTitle: '📖 Read Note',
          options: {
            opensAppToForeground: true,
          },
        },
        {
          identifier: 'NOTE_SNOOZE',
          buttonTitle: '⏰ Snooze 30min',
          options: {
            opensAppToForeground: false,
          },
        },
        {
          identifier: 'DISMISS_NOTE',
          buttonTitle: 'Dismiss',
          options: {
            isDestructive: true,
          },
        },
      ]);

      console.log('✅ Notification categories registered');
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('❌ Notification setup failed:', error);
      return false;
    }
  }

  // ──────────────────────────────────────────────────────────────
  // HANDLE BUTTON ACTIONS
  // ──────────────────────────────────────────────────────────────
  addNotificationListeners() {
    // Handle notification button taps and notification taps
    const responseListener = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const { actionIdentifier, notification } = response;
        const data = notification.request.content.data;
        const categoryId = notification.request.content.categoryIdentifier;

        console.log('👆 Button tapped:', { actionIdentifier, categoryId, data });

        // ==========================================================
        // LOVE MESSAGE BUTTON ACTIONS
        // ==========================================================
        if (categoryId === 'love_message' || data.type === 'love_message') {
          switch (actionIdentifier) {
            case 'REPLY':
              await this.handleLoveReply(data);
              break;
            case 'SEND_LOVE':
              await this.handleSendLove(data);
              break;
            case 'LOVE_LATER':
              await this.handleLoveLater(data);
              break;
            case 'DISMISS':
              console.log('Love message dismissed');
              break;
          }
        }

        // ==========================================================
        // MEMORY REMINDER BUTTON ACTIONS
        // ==========================================================
        else if (categoryId === 'memory_reminder' || data.type === 'memory_reminder') {
          switch (actionIdentifier) {
            case 'VIEW_MEMORY':
              await this.handleViewMemory(data);
              break;
            case 'REMIND_LATER':
              await this.handleRemindLater(data);
              break;
            case 'DISMISS_MEMORY':
              console.log('Memory reminder dismissed');
              break;
          }
        }

        // ==========================================================
        // MOOD CHECK BUTTON ACTIONS
        // ==========================================================
        else if (categoryId === 'mood_check' || data.type === 'mood_check') {
          switch (actionIdentifier) {
            case 'MOOD_HAPPY':
              await this.saveMood('Happy', data);
              break;
            case 'MOOD_LOVED':
              await this.saveMood('Loved', data);
              break;
            case 'MOOD_SAD':
              await this.saveMood('Sad', data);
              break;
            case 'MOOD_OPEN_APP':
              await this.openAppToMoodScreen();
              break;
          }
        }

        // ==========================================================
        // NOTE REMINDER BUTTON ACTIONS
        // ==========================================================
        else if (categoryId === 'note_reminder' || data.type === 'note_reminder') {
          switch (actionIdentifier) {
            case 'READ_NOTE':
              await this.handleReadNote(data);
              break;
            case 'NOTE_SNOOZE':
              await this.handleNoteSnooze(data);
              break;
            case 'DISMISS_NOTE':
              console.log('Note reminder dismissed');
              break;
          }
        }
      }
    );

    return () => {
      Notifications.removeNotificationSubscription(responseListener);
    };
  }

  // ==========================================================
  // LOVE MESSAGE ACTION HANDLERS
  // ==========================================================

  private async handleLoveReply(data: any) {
    // Open app and show a reply modal
    if (this.navigationRef) {
      this.navigationRef.navigate('Notes', { 
        openReplyModal: true,
        replyTo: data.sender || 'your love'
      });
    }
    
    // Also store that she wants to reply
    await AsyncStorage.setItem('pendingReply', JSON.stringify({
      to: data.sender || 'love',
      timestamp: new Date().toISOString()
    }));
    
    console.log('💌 Reply action - ready for her to write back');
  }

  private async handleSendLove(data: any) {
    // Save love reaction without opening app
    const reactions = await AsyncStorage.getItem('loveReactions');
    const list = reactions ? JSON.parse(reactions) : [];
    list.push({
      type: 'love',
      timestamp: new Date().toISOString(),
      source: 'notification_button'
    });
    await AsyncStorage.setItem('loveReactions', JSON.stringify(list));
    
    // Also increment love counter
    const loveCount = await AsyncStorage.getItem('loveCount');
    const count = loveCount ? parseInt(loveCount) : 0;
    await AsyncStorage.setItem('loveCount', (count + 1).toString());
    
    console.log('❤️ Love reaction saved! Total love count:', count + 1);
  }

  private async handleLoveLater(data: any) {
    // Schedule a new notification for later (1 hour)
    const laterTrigger = Platform.OS === 'android'
      ? { seconds: 3600, channelId: 'love_channel' }
      : { seconds: 3600 };

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '💕 Still Thinking of You',
        body: 'Just wanted to remind you that you\'re loved! 💖',
        sound: true,
        categoryIdentifier: 'love_message',
        data: { type: 'love_message', reminderCount: 1 },
      },
      trigger: laterTrigger,
    });
    
    console.log('⏰ Love reminder scheduled for 1 hour later');
  }

  // ==========================================================
  // MEMORY REMINDER ACTION HANDLERS
  // ==========================================================

  private async handleViewMemory(data: any) {
    // Navigate directly to the specific memory
    if (this.navigationRef && data.memoryId) {
      this.navigationRef.navigate('Memories', { 
        highlightMemoryId: data.memoryId 
      });
    } else if (this.navigationRef) {
      this.navigationRef.navigate('Memories');
    }
    
    console.log('📸 Opening memory:', data.memoryId || 'all memories');
  }

  private async handleRemindLater(data: any) {
    // Schedule a reminder for 1 hour later
    const laterTrigger = Platform.OS === 'android'
      ? { seconds: 3600, channelId: 'love_channel' }
      : { seconds: 3600 };

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📸 Memory Reminder',
        body: `Ready to look at ${data.memory || 'your memories'}? ✨`,
        sound: true,
        categoryIdentifier: 'memory_reminder',
        data: { type: 'memory_reminder', ...data },
      },
      trigger: laterTrigger,
    });
    
    console.log('⏰ Memory reminder scheduled for 1 hour later');
  }

  // ==========================================================
  // MOOD CHECK ACTION HANDLERS
  // ==========================================================

  private async saveMood(mood: string, data: any) {
    try {
      // Get existing mood history
      const history = await AsyncStorage.getItem('moodHistory');
      const moods = history ? JSON.parse(history) : [];
      
      // Add new mood entry
      const moodEntry = {
        mood: mood,
        timestamp: new Date().toISOString(),
        source: 'notification_button',
        notificationId: data.id
      };
      moods.push(moodEntry);
      
      // Save back
      await AsyncStorage.setItem('moodHistory', JSON.stringify(moods));
      
      // Also update today's mood
      const today = new Date().toDateString();
      await AsyncStorage.setItem(`mood_${today}`, mood);
      
      console.log(`✅ Mood "${mood}" saved from notification button!`);
      
      // Optional: Show a quick feedback toast (if you want)
      // You could also send a thanks notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '💕 Thanks for sharing!',
          body: `I'm glad you're feeling ${mood} today. You're amazing! 🌸`,
          sound: true,
        },
        trigger: { seconds: 1, channelId: 'love_channel' },
      });
      
    } catch (error) {
      console.error('Failed to save mood:', error);
    }
  }

  private async openAppToMoodScreen() {
    if (this.navigationRef) {
      this.navigationRef.navigate('Vibe');
    }
    console.log('Opening app to mood screen');
  }

  // ==========================================================
  // NOTE REMINDER ACTION HANDLERS
  // ==========================================================

  private async handleReadNote(data: any) {
    // Navigate directly to the specific note
    if (this.navigationRef && data.noteId) {
      this.navigationRef.navigate('Notes', { 
        openNoteId: data.noteId 
      });
    } else if (this.navigationRef) {
      this.navigationRef.navigate('Notes');
    }
    
    console.log('📖 Opening note:', data.noteId || 'all notes');
  }

  private async handleNoteSnooze(data: any) {
    // Schedule snooze for 30 minutes
    const snoozeTrigger = Platform.OS === 'android'
      ? { seconds: 1800, channelId: 'love_channel' }
      : { seconds: 1800 };

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📝 Note Reminder',
        body: `Don't forget to read "${data.noteTitle || 'your note'}" 💌`,
        sound: true,
        categoryIdentifier: 'note_reminder',
        data: { type: 'note_reminder', ...data, snoozeCount: (data.snoozeCount || 0) + 1 },
      },
      trigger: snoozeTrigger,
    });
    
    console.log('⏰ Note snoozed for 30 minutes');
  }

  // ==========================================================
  // HELPER METHODS
  // ==========================================================

  async sendLoveMessageNotification(title: string, body: string, data?: any) {
    const trigger = Platform.OS === 'android'
      ? { seconds: 1, channelId: 'love_channel' }
      : null;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: title,
        body: body,
        sound: true,
        categoryIdentifier: 'love_message',
        data: { type: 'love_message', ...data },
      },
      trigger: trigger,
    });
    
    console.log('💕 Love message notification sent with Reply/Send Love/Later buttons');
  }

  async sendMemoryReminderNotification(memoryTitle: string, memoryId: string) {
    const trigger = Platform.OS === 'android'
      ? { seconds: 1, channelId: 'love_channel' }
      : null;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📸 Memory Reminder',
        body: `Remember ${memoryTitle}? Tap to relive the moment! 💭`,
        sound: true,
        categoryIdentifier: 'memory_reminder',
        data: { type: 'memory_reminder', memory: memoryTitle, memoryId: memoryId },
      },
      trigger: trigger,
    });
    
    console.log('📸 Memory reminder sent with View/Remind Later/Dismiss buttons');
  }

  async sendMoodCheckNotification() {
    const trigger = Platform.OS === 'android'
      ? { seconds: 1, channelId: 'love_channel' }
      : null;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🌙 How are you feeling?',
        body: 'Tap how you feel right now. I care about you! 💕',
        sound: true,
        categoryIdentifier: 'mood_check',
        data: { type: 'mood_check' },
      },
      trigger: trigger,
    });
    
    console.log('🌙 Mood check sent with Happy/Loved/Sad buttons');
  }

  async sendNoteReminderNotification(noteTitle: string, noteId: string) {
    const trigger = Platform.OS === 'android'
      ? { seconds: 1, channelId: 'love_channel' }
      : null;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📝 Note Reminder',
        body: `You have a note waiting: "${noteTitle}" ✨`,
        sound: true,
        categoryIdentifier: 'note_reminder',
        data: { type: 'note_reminder', noteTitle: noteTitle, noteId: noteId },
      },
      trigger: trigger,
    });
    
    console.log('📝 Note reminder sent with Read/Snooze/Dismiss buttons');
  }

  // Get love reaction count
  async getLoveCount(): Promise<number> {
    const count = await AsyncStorage.getItem('loveCount');
    return count ? parseInt(count) : 0;
  }

  // Get today's mood
  async getTodayMood(): Promise<string | null> {
    const today = new Date().toDateString();
    return await AsyncStorage.getItem(`mood_${today}`);
  }
}
