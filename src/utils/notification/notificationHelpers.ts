// src/utils/notification/notificationHelpers.ts

import { formatDistanceToNow, format } from 'date-fns';
import { AppNotification, NotificationType, NotificationCategory } from '../../types/notifications';

// Format notification time
export function formatNotificationTime(date: string | Date): string {
  const parsedDate = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - parsedDate.getTime();

  // If less than 24 hours, show relative time
  if (diff < 24 * 60 * 60 * 1000) {
    return formatDistanceToNow(parsedDate, { addSuffix: true });
  }

  // If less than 7 days, show day of week
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    return format(parsedDate, 'EEEE');
  }

  // Otherwise show date
  return format(parsedDate, 'MMM d, yyyy');
}

// Get notification icon based on type
export function getNotificationIcon(type: NotificationType): {
  name: string;
  color: string;
} {
  switch (type) {
    case 'reminder':
      return { name: 'time-outline', color: '#F59E0B' };
    case 'system':
      return { name: 'information-circle-outline', color: '#3B82F6' };
    case 'chat':
      return { name: 'chatbubble-outline', color: '#10B981' };
    case 'task':
      return { name: 'checkmark-circle-outline', color: '#8B5CF6' };
    case 'progress':
      return { name: 'sync-outline', color: '#6366F1' };
    case 'alert':
      return { name: 'alert-circle-outline', color: '#EF4444' };
    default:
      return { name: 'notifications-outline', color: '#6B7280' };
  }
}

// Get notification category label
export function getCategoryLabel(category: NotificationCategory): string {
  switch (category) {
    case 'message': return 'Message';
    case 'task': return 'Task';
    case 'reminder': return 'Reminder';
    case 'system': return 'System';
    case 'social': return 'Social';
    default: return 'Notification';
  }
}

// Group notifications by date
export function groupNotificationsByDate(notifications: AppNotification[]): {
  [key: string]: AppNotification[];
} {
  const groups: { [key: string]: AppNotification[] } = {};

  for (const notification of notifications) {
    const date = new Date(notification.created_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let key: string;
    if (date.toDateString() === today.toDateString()) {
      key = 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      key = 'Yesterday';
    } else {
      key = format(date, 'MMMM d, yyyy');
    }

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(notification);
  }

  return groups;
}

// Sort notifications by priority
export function sortNotificationsByPriority(notifications: AppNotification[]): AppNotification[] {
  const priorityOrder: { [key: string]: number } = {
    high: 0,
    normal: 1,
    low: 2,
  };

  return [...notifications].sort((a, b) => {
    const aPriority = a.priority || 'normal';
    const bPriority = b.priority || 'normal';
    return (priorityOrder[aPriority] || 1) - (priorityOrder[bPriority] || 1);
  });
}

// Get notification summary
export function getNotificationSummary(notifications: AppNotification[]): {
  total: number;
  unread: number;
  byType: { [key in NotificationType]?: number };
} {
  const summary = {
    total: notifications.length,
    unread: 0,
    byType: {} as { [key in NotificationType]?: number },
  };

  for (const notification of notifications) {
    if (!notification.read) {
      summary.unread++;
    }

    const type = notification.type;
    summary.byType[type] = (summary.byType[type] || 0) + 1;
  }

  return summary;
}

// Check if notification is expired
export function isNotificationExpired(notification: AppNotification): boolean {
  if (!notification.expires_at) return false;
  const expiresAt = new Date(notification.expires_at);
  return expiresAt < new Date();
}

// Filter notifications
export function filterNotifications(
  notifications: AppNotification[],
  filters: {
    types?: NotificationType[];
    read?: boolean;
    search?: string;
    category?: NotificationCategory;
  }
): AppNotification[] {
  let result = [...notifications];

  if (filters.types && filters.types.length > 0) {
    result = result.filter(n => filters.types!.includes(n.type));
  }

  if (filters.read !== undefined) {
    result = result.filter(n => n.read === filters.read);
  }

  if (filters.category) {
    result = result.filter(n => n.category === filters.category);
  }

  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    result = result.filter(n =>
      n.title.toLowerCase().includes(searchLower) ||
      n.body.toLowerCase().includes(searchLower)
    );
  }

  return result;
}

// Generate notification sound based on type
export function getNotificationSound(type: NotificationType): string {
  switch (type) {
    case 'chat':
      return 'notification_chat.wav';
    case 'task':
      return 'notification_task.wav';
    case 'reminder':
      return 'notification_reminder.wav';
    case 'alert':
      return 'notification_alert.wav';
    default:
      return 'notification_default.wav';
  }
}

// Get notification color based on type
export function getNotificationColor(type: NotificationType): string {
  switch (type) {
    case 'reminder': return '#F59E0B';
    case 'system': return '#3B82F6';
    case 'chat': return '#10B981';
    case 'task': return '#8B5CF6';
    case 'progress': return '#6366F1';
    case 'alert': return '#EF4444';
    default: return '#6B7280';
  }
}
