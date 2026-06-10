// services/RemoteNotificationService.ts
import * as Notifications from 'expo-notifications';
import * as Updates from 'expo-updates';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export interface RemoteNotification {
  id: string;
  title: string;
  body: string;
  type: 'love_message' | 'memory_reminder' | 'surprise' | 'custom';
  cooldown?: number;
  sound?: boolean;
  data?: any;
  createdAt: string;
}

export class RemoteNotificationService {
  private static instance: RemoteNotificationService;
  private isInitialized = false;

  static getInstance(): RemoteNotificationService {
    if (!RemoteNotificationService.instance) {
      RemoteNotificationService.instance = new RemoteNotificationService();
    }
    return RemoteNotificationService.instance;
  }

  // Initialize notifications (call once on app start)
  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      // Request permissions
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('❌ Notification permissions not granted');
        return false;
      }

      // Create notification channel for Android (CRITICAL FOR APK)
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('remote_notifications', {
          name: 'Remote Notifications',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF6B9D',
          enableVibrate: true,
          enableLights: true,
        });
        console.log('✅ Android notification channel created');
      }

      this.isInitialized = true;
      console.log('✅ Remote notification service initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize:', error);
      return false;
    }
  }

  // Check for pending remote notifications from OTA updates
  async checkForRemoteNotifications(): Promise<RemoteNotification | null> {
    try {
      // Try to get notification from multiple sources
      let notification = null;
      
      // Source 1: Check for inline notification in constants
      try {
        const { REMOTE_NOTIFICATION } = require('../constants/RemoteNotification');
        if (REMOTE_NOTIFICATION && REMOTE_NOTIFICATION.id) {
          notification = REMOTE_NOTIFICATION;
        }
      } catch (e) {
        // No inline notification
      }

      // Source 2: Check AsyncStorage for pending notification
      if (!notification) {
        const pendingJson = await AsyncStorage.getItem('pending_remote_notification');
        if (pendingJson) {
          notification = JSON.parse(pendingJson);
          await AsyncStorage.removeItem('pending_remote_notification');
        }
      }

      // Source 3: Check for notification from update metadata
      if (!notification && Updates.manifest) {
        try {
          const manifest = Updates.manifest as any;
          if (manifest.extra?.expoClient?.extra?.remoteNotification) {
            notification = manifest.extra.expoClient.extra.remoteNotification;
          }
        } catch (e) {
          // No manifest notification
        }
      }

      if (!notification) {
        return null;
      }

      // Check cooldown
      const lastShown = await AsyncStorage.getItem(`last_notification_${notification.id}`);
      if (lastShown && notification.cooldown) {
        const timeSince = Date.now() - parseInt(lastShown);
        if (timeSince < notification.cooldown) {
          console.log('⏰ Notification in cooldown period');
          return null;
        }
      }

      // Show the notification
      await this.showNotification(notification);
      
      // Mark as shown
      await AsyncStorage.setItem(`last_notification_${notification.id}`, Date.now().toString());
      await this.addToHistory(notification);
      
      return notification;
    } catch (error) {
      console.error('❌ Failed to check notifications:', error);
      return null;
    }
  }

  // Show local notification (WORKS IN APK)
  async showNotification(notification: RemoteNotification): Promise<boolean> {
    try {
      // Build trigger with Android channel ID
      const trigger: any = null; // null = immediate
      
      if (Platform.OS === 'android') {
        // For Android, we need to specify the channel
        await Notifications.scheduleNotificationAsync({
          content: {
            title: notification.title,
            body: notification.body,
            sound: notification.sound !== false,
            data: { 
              type: notification.type,
              id: notification.id,
              ...notification.data 
            },
          },
          trigger: {
            channelId: 'remote_notifications', // CRITICAL FOR APK
            seconds: 1,
          },
        });
      } else {
        // iOS
        await Notifications.scheduleNotificationAsync({
          content: {
            title: notification.title,
            body: notification.body,
            sound: notification.sound !== false,
            data: { 
              type: notification.type,
              id: notification.id,
              ...notification.data 
            },
          },
          trigger: null,
        });
      }
      
      console.log('✅ Notification shown:', notification.title);
      return true;
    } catch (error) {
      console.error('❌ Failed to show notification:', error);
      // Fallback: Show alert
      Alert.alert(notification.title, notification.body);
      return false;
    }
  }

  // Store notification in history
  async addToHistory(notification: RemoteNotification) {
    try {
      const history = await AsyncStorage.getItem('remote_notification_history');
      const historyArray = history ? JSON.parse(history) : [];
      
      historyArray.unshift({
        ...notification,
        shownAt: new Date().toISOString(),
      });
      
      // Keep last 100
      const trimmed = historyArray.slice(0, 100);
      await AsyncStorage.setItem('remote_notification_history', JSON.stringify(trimmed));
    } catch (error) {
      console.error('Failed to save history:', error);
    }
  }

  // Get notification history
  async getNotificationHistory(): Promise<RemoteNotification[]> {
    try {
      const history = await AsyncStorage.getItem('remote_notification_history');
      return history ? JSON.parse(history) : [];
    } catch (error) {
      return [];
    }
  }

  // Clear all pending notifications
  async clearPendingNotifications() {
    await AsyncStorage.removeItem('pending_remote_notification');
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('🗑️ Cleared all pending notifications');
  }

  // Listen for notification taps
  addNotificationListeners() {
    const responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        console.log('👆 User tapped notification:', data);
        
        // You can navigate based on notification type
        if (data.type === 'love_message') {
          // Navigate to home screen
        } else if (data.type === 'memory_reminder') {
          // Navigate to memories screen
        }
      }
    );

    return () => {
      Notifications.removeNotificationSubscription(responseListener);
    };
  }
}
