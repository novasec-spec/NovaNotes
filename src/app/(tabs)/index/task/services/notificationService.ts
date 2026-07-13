// task/services/notificationService.ts
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TaskService } from './taskService';
import { Task } from '../types/task.types';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface Notification {
  id: string;
  title: string;
  body: string;
  data?: any;
  type: 'task_due' | 'task_overdue' | 'task_reminder' | 'task_suggest' | 'sync' | 'smart_suggestion' | 'task_shared';
  priority: 'high' | 'default' | 'low';
  scheduledAt?: string;
  taskId?: string;
  read?: boolean;
}

export class NotificationService {
  private static instance: NotificationService;
  private taskService = TaskService.getInstance();
  private checkInterval: NodeJS.Timeout | null = null;
  private lastCheckTime: number = 0;

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async initialize(): Promise<void> {
    try {
      // Request permissions
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('Notification permissions not granted');
        return;
      }

      // Set up notification channel for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('task_channel', {
          name: 'Task Notifications',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF6B9D',
          sound: true,
        });
      }

      // Check every 15 minutes
      this.checkInterval = setInterval(async () => {
        await this.checkAndSendNotifications();
      }, 15 * 60 * 1000);

      // Initial check after 30 seconds
      setTimeout(() => this.checkAndSendNotifications(), 30000);

      // Listen for notifications
      const subscription = Notifications.addNotificationReceivedListener(
        this.handleNotificationReceived
      );

      const responseSubscription = Notifications.addNotificationResponseReceivedListener(
        this.handleNotificationResponse
      );

      // Cleanup on unmount
      return () => {
        subscription.remove();
        responseSubscription.remove();
        if (this.checkInterval) {
          clearInterval(this.checkInterval);
        }
      };
    } catch (error) {
      console.error('Initialize notifications error:', error);
    }
  }

  private handleNotificationReceived = (notification: any) => {
    console.log('📨 Notification received:', notification);
  };

  private handleNotificationResponse = async (response: any) => {
    console.log('📱 Notification tapped:', response);
    const data = response.notification.request.content.data;
    
    if (data.taskId) {
      // Navigate to task or open app
      // You can use navigation here
    }
  };

  async sendNotification(notification: Notification): Promise<void> {
    try {
      // Save to history
      await this.saveNotificationHistory(notification);

      // Send actual notification with proper trigger
      await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.body,
          data: notification.data || {},
          sound: notification.priority === 'high',
          priority: notification.priority === 'high' 
            ? Notifications.AndroidNotificationPriority.HIGH 
            : Notifications.AndroidNotificationPriority.DEFAULT,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 1,
        } as Notifications.TimeIntervalTriggerInput,
      });

      console.log('📨 Notification sent:', notification.title);

    } catch (error) {
      console.error('Send notification error:', error);
    }
  }

  async sendImmediateNotification(notification: Notification): Promise<void> {
    try {
      // Save to history
      await this.saveNotificationHistory(notification);

      // Send immediate notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.body,
          data: notification.data || {},
          sound: true,
        },
        trigger: null, // null means immediate
      });

      console.log('📨 Immediate notification sent:', notification.title);

    } catch (error) {
      console.error('Send immediate notification error:', error);
    }
  }

  async sendShareNotification(shareData: {
    taskId: string;
    taskTitle: string;
    sharedBy: string;
    sharedWith: string;
    message?: string;
    taskData: any;
  }): Promise<void> {
    const notification: Notification = {
      id: `share_${Date.now()}`,
      title: `📨 ${shareData.sharedBy} shared a task with you`,
      body: shareData.message 
        ? `"${shareData.taskTitle}" - ${shareData.message}`
        : `"${shareData.taskTitle}" has been shared with you`,
      type: 'task_shared',
      priority: 'high',
      taskId: shareData.taskId,
      data: {
        task: shareData.taskData,
        sharedBy: shareData.sharedBy,
        type: 'task_shared',
        taskId: shareData.taskId,
      },
    };

    // Use immediate notification for shares
    await this.sendImmediateNotification(notification);
  }

  async checkAndSendNotifications(): Promise<void> {
    const now = Date.now();
    
    // Don't check more than once per minute
    if (now - this.lastCheckTime < 60000) return;
    this.lastCheckTime = now;

    try {
      // Get all notifications to send
      const notifications = await this.gatherNotifications();
      
      // Send notifications (max 3 at a time)
      const toSend = notifications.slice(0, 3);
      for (const notification of toSend) {
        await this.sendNotification(notification);
        if (notification.taskId) {
          await this.taskService.markReminderSent(notification.taskId);
        }
      }

      // Smart suggestions (randomly suggest a task)
      if (Math.random() < 0.1) {
        const suggestion = await this.generateSmartSuggestion();
        if (suggestion) {
          await this.sendNotification(suggestion);
        }
      }

    } catch (error) {
      console.error('Check notifications error:', error);
    }
  }

  private async gatherNotifications(): Promise<Notification[]> {
    const notifications: Notification[] = [];

    // Overdue tasks
    const overdue = await this.taskService.getOverdueTasks();
    overdue.forEach(task => {
      notifications.push({
        id: `overdue_${task.id}`,
        title: '⚠️ Task Overdue',
        body: `"${task.title}" is overdue. Please take action!`,
        type: 'task_overdue',
        priority: 'high',
        taskId: task.id,
        data: { task, type: 'overdue' },
      });
    });

    // Tasks due today
    const dueToday = await this.taskService.getTasksDueToday();
    dueToday.forEach(task => {
      if (!task.reminderSent) {
        notifications.push({
          id: `due_${task.id}`,
          title: `📅 Task Due Today`,
          body: `"${task.title}" is due ${task.dueTime ? `at ${task.dueTime}` : 'today'}`,
          type: 'task_due',
          priority: 'default',
          taskId: task.id,
          data: { task, type: 'due_today' },
        });
      }
    });

    return notifications;
  }

  private async generateSmartSuggestion(): Promise<Notification | null> {
    const tasks = await this.taskService.getLocalTasks();
    const activeTasks = tasks.filter(t => !t.completed && !t._deleted);
    if (activeTasks.length === 0) return null;

    const candidates = activeTasks.filter(t => t.priority !== 'critical');
    if (candidates.length === 0) return null;

    const randomTask = candidates[Math.floor(Math.random() * candidates.length)];
    
    return {
      id: `suggest_${Date.now()}`,
      title: '💡 Quick Task Suggestion',
      body: `How about working on "${randomTask.title}" now?`,
      type: 'smart_suggestion',
      priority: 'low',
      taskId: randomTask.id,
      data: { task: randomTask, type: 'suggestion' },
    };
  }

  private async saveNotificationHistory(notification: Notification): Promise<void> {
    try {
      const key = 'notification_history';
      const existing = await AsyncStorage.getItem(key);
      const history = existing ? JSON.parse(existing) : [];
      
      history.unshift({
        ...notification,
        sentAt: new Date().toISOString(),
        read: false,
      });

      while (history.length > 200) history.pop();
      await AsyncStorage.setItem(key, JSON.stringify(history));
    } catch (error) {
      console.error('Save notification history error:', error);
    }
  }

  async getNotificationHistory(): Promise<Notification[]> {
    try {
      const key = 'notification_history';
      const existing = await AsyncStorage.getItem(key);
      return existing ? JSON.parse(existing) : [];
    } catch {
      return [];
    }
  }

  async clearNotificationHistory(): Promise<void> {
    await AsyncStorage.removeItem('notification_history');
  }
}
