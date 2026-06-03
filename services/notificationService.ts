// services/notificationService.ts - Complete version
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../config/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export class NotificationService {
  private expoPushToken: string | null = null;
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async setupNotifications() {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      console.log('Notification permissions not granted');
      return false;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('love', {
        name: 'Love Notifications',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6B9D',
      });
    }

    // Get and save the token
    await this.getAndSaveExpoPushToken();
    return true;
  }

  private async getAndSaveExpoPushToken() {
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        console.warn('Project ID not found. Run: eas build:configure');
        return null;
      }

      const token = await Notifications.getExpoPushTokenAsync({ projectId });
      this.expoPushToken = token.data;
      
      // Save to Supabase automatically
      await this.saveTokenToDatabase(this.expoPushToken);
      
      console.log('Push token saved to Supabase:', this.expoPushToken);
      return this.expoPushToken;
    } catch (error) {
      console.error('Failed to get push token:', error);
      return null;
    }
  }

  private async saveTokenToDatabase(token: string) {
    try {
      const { error } = await supabase
        .from('user_data')
        .upsert({
          user_id: this.userId,
          push_token: token,
          last_token_update: new Date().toISOString(),
        });

      if (error) throw error;
      console.log('Token saved to Supabase');
    } catch (error) {
      console.error('Failed to save token to Supabase:', error);
    }
  }

  // Send notification directly from the app (optional)
  async sendLoveNotification(title: string, body: string) {
    if (!this.expoPushToken) {
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
          to: this.expoPushToken,
          title: title,
          body: body,
          sound: 'default',
          data: { type: 'love_message', from: 'your_boyfriend' },
        }),
      });

      const result = await response.json();
      console.log('Notification sent:', result);
      return true;
    } catch (error) {
      console.error('Failed to send notification:', error);
      return false;
    }
  }

  // Schedule daily love messages

// services/notificationService.ts - FIXED VERSION

async scheduleDailyLoveMessage() {
  // Morning message (9 AM)
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Good Morning Baby! 🌅',
      body: 'Just wanted to be the first to say you\'re amazing today!',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,  // ✅ ADD THIS
      hour: 9,
      minute: 0,
      repeats: true,
    },
  });

  // Afternoon check-in (1 PM)
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Thinking of You 💕',
      body: 'Hope your day is going wonderfully!',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,  // ✅ ADD THIS
      hour: 13,
      minute: 0,
      repeats: true,
    },
  });
}

  addNotificationListeners() {
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification tapped:', response);
      // You can navigate based on the notification data
      if (response.notification.request.content.data?.type === 'love_message') {
        // Navigate to a special screen if needed
      }
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener);
      Notifications.removeNotificationSubscription(responseListener);
    };
  }
}
