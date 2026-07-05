import { Platform, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TaskService } from './taskService';
import { Task } from '../types/task.types';

export interface Notification {
  id: string;
  title: string;
  body: string;
  data?: any;
  type: 'task_due' | 'task_overdue' | 'task_reminder' | 'task_suggest' | 'sync' | 'smart_suggestion';
  priority: 'high' | 'default' | 'low';
  scheduledAt?: string;
  taskId?: string;
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
    // Check every 15 minutes
    this.checkInterval = setInterval(async () => {
      await this.checkAndSendNotifications();
    }, 15 * 60 * 1000);

    // Initial check after 30 seconds
    setTimeout(() => this.checkAndSendNotifications(), 30000);

    // Listen for app state changes
    AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active') {
        await this.checkAndSendNotifications();
      }
    });
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
        await this.markTaskReminderSent(notification.taskId);
      }

      // Smart suggestions (randomly suggest a task)
      if (Math.random() < 0.1) { // 10% chance
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

    // Overdue tasks - High priority
    const overdue = await this.taskService.getOverdueTasks();
    overdue.forEach(task => {
      notifications.push({
        id: `overdue_${task.id}`,
        title: '⚠️ Task Overdue',
        body: `"${task.title}" is overdue. Please take action!`,
        type: 'task_overdue',
        priority: 'high',
        taskId: task.id,
        data: { task },
      });
    });

    // Tasks due today - Default priority
    const dueToday = await this.taskService.getTasksDueToday();
    dueToday.forEach(task => {
      if (!task.reminderSent) {
        notifications.push({
          id: `due_${task.id}`,
          title: `📅 "${task.title}" Due Today`,
          body: task.dueTime 
            ? `Due at ${task.dueTime} - ${task.category || 'No category'}`
            : `Due today - ${task.category || 'No category'}`,
          type: 'task_due',
          priority: 'default',
          taskId: task.id,
          data: { task },
        });
      }
    });

    // Tasks due in next 2 hours - High priority if not reminded
    const dueSoon = await this.taskService.getTasksDueSoon(2);
    dueSoon.forEach(task => {
      if (!task.reminderSent) {
        notifications.push({
          id: `soon_${task.id}`,
          title: `⏰ "${task.title}" Due Soon`,
          body: `Due in ${this.getTimeUntil(task.dueDate!)} - ${task.priority} priority`,
          type: 'task_reminder',
          priority: 'high',
          taskId: task.id,
          data: { task },
        });
      }
    });

    return notifications;
  }

  private async generateSmartSuggestion(): Promise<Notification | null> {
    const tasks = await this.taskService.getLocalTasks();
    
    // Find an active task that might be a good candidate for suggestion
    const activeTasks = tasks.filter(t => !t.completed && !t._deleted);
    if (activeTasks.length === 0) return null;

    // Pick a random active task that's not too urgent
    const candidates = activeTasks.filter(t => t.priority !== 'critical');
    if (candidates.length === 0) return null;

    const randomTask = candidates[Math.floor(Math.random() * candidates.length)];
    
    return {
      id: `suggest_${Date.now()}`,
      title: '💡 Quick Task Suggestion',
      body: `How about working on "${randomTask.title}" now? ${randomTask.estimatedHours ? `(Estimated: ${randomTask.estimatedHours}h)` : ''}`,
      type: 'smart_suggestion',
      priority: 'low',
      taskId: randomTask.id,
      data: { task: randomTask },
      scheduledAt: new Date().toISOString(),
    };
  }

  async sendNotification(notification: Notification): Promise<void> {
    // Save to history
    await this.saveNotificationHistory(notification);

    // Log to console for development
    console.log('📨 Notification:', {
      title: notification.title,
      body: notification.body,
      type: notification.type,
      priority: notification.priority,
    });

    // Here you would integrate with your notification system
    // Example with Expo:
    // if (Platform.OS !== 'web') {
    //   await scheduleNotificationAsync({
    //     content: {
    //       title: notification.title,
    //       body: notification.body,
    //       data: notification.data,
    //     },
    //     trigger: { seconds: 1 },
    //   });
    // }
  }

  private async markTaskReminderSent(taskId?: string): Promise<void> {
    if (!taskId) return;
    await this.taskService.markReminderSent(taskId);
  }

  private async saveNotificationHistory(notification: Notification): Promise<void> {
    try {
      const key = 'notification_history';
      const existing = await AsyncStorage.getItem(key);
      const history = existing ? JSON.parse(existing) : [];
      
      history.unshift({
        ...notification,
        sentAt: new Date().toISOString(),
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

  private getTimeUntil(dateString: string): string {
    const diff = new Date(dateString).getTime() - Date.now();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m`;
    return 'very soon';
  }

  async clearNotificationHistory(): Promise<void> {
    await AsyncStorage.removeItem('notification_history');
  }
}
