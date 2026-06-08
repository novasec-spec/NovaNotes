// services/RemoteNotificationService.ts
import * as Notifications from 'expo-notifications';
import * as Updates from 'expo-updates';
import { REMOTE_NOTIFICATION, shouldShowNotification } from '../constants/RemoteNotification';
import AsyncStorage from '@react-native-async-storage/async-storage';

export class RemoteNotificationService {
  
  // Check for remote notifications on app start
  static async checkForRemoteNotifications() {
    try {
      // Check if there's a pending notification
      const notification = REMOTE_NOTIFICATION;
      
      if (notification && shouldShowNotification()) {
        // Show the notification
        await this.showLocalNotification(notification);
        
        // Mark as shown
        await this.markNotificationShown(notification.id);
        
        return notification;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to check remote notifications:', error);
      return null;
    }
  }
  
  // Show local notification
  static async showLocalNotification(notification: any) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.body,
          sound: notification.sound,
          data: notification.data,
        },
        trigger: null, // Show immediately
      });
      
      console.log('✅ Remote notification shown:', notification.title);
      
      // Store in history
      await this.addToHistory(notification);
      
    } catch (error) {
      console.error('Failed to show notification:', error);
    }
  }
  
  // Keep history of shown notifications
  static async addToHistory(notification: any) {
    try {
      const history = await AsyncStorage.getItem('notification_history');
      const historyArray = history ? JSON.parse(history) : [];
      
      historyArray.unshift({
        ...notification,
        shownAt: new Date().toISOString(),
      });
      
      // Keep only last 50
      const trimmed = historyArray.slice(0, 50);
      await AsyncStorage.setItem('notification_history', JSON.stringify(trimmed));
      
    } catch (error) {
      console.error('Failed to save notification history:', error);
    }
  }
  
  // Get notification history
  static async getNotificationHistory() {
    try {
      const history = await AsyncStorage.getItem('notification_history');
      return history ? JSON.parse(history) : [];
    } catch (error) {
      return [];
    }
  }
  
  // Check for updates periodically
  static setupUpdateChecker() {
    // Check for updates every hour
    setInterval(async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          console.log('🔄 Update available, fetching...');
          await Updates.fetchUpdateAsync();
          // Don't reload immediately, let the user continue
        }
      } catch (error) {
        console.error('Update check failed:', error);
      }
    }, 3600000); // Every hour
  }
  
  // Manually check and apply updates
  static async checkAndApplyUpdate() {
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to apply update:', error);
      return false;
    }
  }
}
