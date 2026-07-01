import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Task } from '../types/task.types';
import { TaskService } from './taskService';

// This is a structure you can adapt to your notification system
export interface NotificationData {
  id: string;
  title: string;
  body: string;
  data?: any;
  type: 'task_due' | 'task_overdue' | 'task_sync' | 'task_reminder';
  priority: 'high' | 'default' | 'low';
  scheduledAt?: string;
  taskId?: string;
}

export class NotificationService {
  private static instance: NotificationService;
  private taskService = TaskService.getInstance();
  private notificationCheckInterval: NodeJS.Timeout | null = null;

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // ============ NOTIFICATION SCHEDULING ============

  async scheduleTaskNotifications(): Promise<void> {
    // Clear existing interval
    if (this.notificationCheckInterval) {
      clearInterval(this.notificationCheckInterval);
    }

    // Check every 30 minutes
    this.notificationCheckInterval = setInterval(async () => {
      await this.checkAndNotifyTasks();
    }, 30 * 60 * 1000);

    // Initial check
    await this.checkAndNotifyTasks();
  }

  async checkAndNotifyTasks(): Promise<void> {
    const lastNotificationTime = await this.getLastNotificationTime();
    const now = new Date();

    // Check if we should run notifications (avoid spamming)
    if (lastNotificationTime && (now.getTime() - lastNotificationTime) < 15 * 60 * 1000) {
      return; // Run max every 15 minutes
    }

    const overdueTasks = await this.taskService.getOverdueTasks();
    const dueSoonTasks = await this.taskService.getTasksDueSoon();

    const notifications: NotificationData[] = [];

    // Overdue tasks (high priority)
    overdueTasks.forEach(task => {
      notifications.push({
        id: `overdue_${task.id}`,
        title: '⚠️ Task Overdue!',
        body: `"${task.title}" is overdue - ${this.getTimeSince(task.dueDate!)}`,
        type: 'task_overdue',
        priority: 'high',
        taskId: task.id,
        data: { task },
      });
    });

    // Tasks due soon (medium priority)
    dueSoonTasks.forEach(task => {
      notifications.push({
        id: `due_${task.id}`,
        title: '📅 Task Due Soon',
        body: `"${task.title}" is due ${this.getTimeUntil(task.dueDate!)}`,
        type: 'task_due',
        priority: 'default',
        taskId: task.id,
        data: { task },
      });
    });

    // Send notifications (max 5 at a time to avoid spamming)
    const toSend = notifications.slice(0, 5);
    for (const notification of toSend) {
      await this.sendNotification(notification);
    }

    await this.updateLastNotificationTime();
  }

  // ============ SEND NOTIFICATION ============

  async sendNotification(notification: NotificationData): Promise<void> {
    // This is where you'll integrate with your notification system
    // Structure your notification data here
    
    console.log('📨 Notification:', {
      id: notification.id,
      title: notification.title,
      body: notification.body,
      type: notification.type,
      priority: notification.priority,
    });

    // Save notification to history
    await this.saveNotificationHistory(notification);

    // You can implement your notification system here
    // For example, using Expo Notifications, React Native Push Notification, etc.
    
    // Example with a custom notification system:
    // if (Platform.OS === 'ios' || Platform.OS === 'android') {
    //   await scheduleLocalNotification(notification);
    // }
  }

  // ============ NOTIFICATION HISTORY ============

  private async saveNotificationHistory(notification: NotificationData): Promise<void> {
    try {
      const historyKey = 'notification_history';
      const existing = await AsyncStorage.getItem(historyKey);
      const history = existing ? JSON.parse(existing) : [];
      
      history.unshift({
        ...notification,
        sentAt: new Date().toISOString(),
      });

      // Keep last 100 notifications
      while (history.length > 100) {
        history.pop();
      }

      await AsyncStorage.setItem(historyKey, JSON.stringify(history));
    } catch (error) {
      console.error('Save notification history error:', error);
    }
  }

  async getNotificationHistory(): Promise<NotificationData[]> {
    try {
      const historyKey = 'notification_history';
      const existing = await AsyncStorage.getItem(historyKey);
      return existing ? JSON.parse(existing) : [];
    } catch {
      return [];
    }
  }

  async getLastNotificationTime(): Promise<number | null> {
    try {
      const time = await AsyncStorage.getItem('last_notification_time');
      return time ? parseInt(time, 10) : null;
    } catch {
      return null;
    }
  }

  async updateLastNotificationTime(): Promise<void> {
    await AsyncStorage.setItem('last_notification_time', Date.now().toString());
  }

  async clearNotificationHistory(): Promise<void> {
    await AsyncStorage.removeItem('notification_history');
  }

  // ============ UTILITY HELPERS ============

  private getTimeSince(dateString: string): string {
    const diff = new Date().getTime() - new Date(dateString).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return 'recently';
  }

  private getTimeUntil(dateString: string): string {
    const diff = new Date(dateString).getTime() - new Date().getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `in ${days} day${days > 1 ? 's' : ''}`;
    if (hours > 0) return `in ${hours} hour${hours > 1 ? 's' : ''}`;
    return 'very soon!';
  }

  // ============ MANUAL NOTIFICATION TRIGGERS ============

  async notifySyncStatus(synced: boolean, count: number): Promise<void> {
    const notification: NotificationData = {
      id: `sync_${Date.now()}`,
      title: synced ? '✅ Tasks Synced' : '⚠️ Sync Issue',
      body: synced 
        ? `${count} task${count > 1 ? 's' : ''} synced successfully` 
        : 'Some tasks could not be synced. Will retry automatically.',
      type: 'task_sync',
      priority: 'default',
    };

    await this.sendNotification(notification);
  }

  async notifyTaskCreated(task: Task): Promise<void> {
    const notification: NotificationData = {
      id: `created_${task.id}`,
      title: '✅ Task Created',
      body: `"${task.title}" has been created`,
      type: 'task_reminder',
      priority: 'low',
      taskId: task.id,
      data: { task },
    };

    await this.sendNotification(notification);
  }

  async notifyTaskCompleted(task: Task): Promise<void> {
    const notification: NotificationData = {
      id: `completed_${task.id}`,
      title: '🎉 Task Completed!',
      body: `"${task.title}" is done! Great job! 🎉`,
      type: 'task_reminder',
      priority: 'low',
      taskId: task.id,
      data: { task },
    };

    await this.sendNotification(notification);
  }
}
