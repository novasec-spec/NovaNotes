// src/utils/notification/notificationConstants.ts

import { NotificationType, NotificationCategory } from '../../types/notifications';

// Notification types with labels
export const NOTIFICATION_TYPES: { [key in NotificationType]: { label: string; icon: string } } = {
  reminder: { label: 'Reminder', icon: 'time-outline' },
  system: { label: 'System', icon: 'information-circle-outline' },
  chat: { label: 'Chat', icon: 'chatbubble-outline' },
  task: { label: 'Task', icon: 'checkmark-circle-outline' },
  progress: { label: 'Progress', icon: 'sync-outline' },
  alert: { label: 'Alert', icon: 'alert-circle-outline' },
};

// Notification categories with labels
export const NOTIFICATION_CATEGORIES: { [key in NotificationCategory]: { label: string; icon: string; color: string } } = {
  message: { label: 'Messages', icon: 'chatbubbles-outline', color: '#10B981' },
  task: { label: 'Tasks', icon: 'checkbox-outline', color: '#8B5CF6' },
  reminder: { label: 'Reminders', icon: 'alarm-outline', color: '#F59E0B' },
  system: { label: 'System', icon: 'information-circle-outline', color: '#3B82F6' },
  social: { label: 'Social', icon: 'people-outline', color: '#EC4899' },
};

// Priority labels
export const PRIORITY_LABELS = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
} as const;

// Default notification settings
export const DEFAULT_NOTIFICATION_SETTINGS = {
  categories: {
    message: { enabled: true, sound: true, vibration: true, priority: 'high' },
    task: { enabled: true, sound: true, vibration: true, priority: 'high' },
    reminder: { enabled: true, sound: true, vibration: true, priority: 'normal' },
    system: { enabled: true, sound: false, vibration: false, priority: 'normal' },
    social: { enabled: true, sound: true, vibration: true, priority: 'normal' },
  },
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '08:00',
  },
  general: {
    showBanners: true,
    showBadges: true,
    playSounds: true,
    vibrate: true,
  },
};

// Notification action identifiers
export const NOTIFICATION_ACTIONS = {
  REPLY: 'reply',
  REPLY_INLINE: 'reply_inline',
  MARK_READ: 'mark_read',
  DISMISS: 'dismiss',
  COMPLETE: 'complete',
  SNOOZE: 'snooze',
  DONE: 'done',
  LATER: 'later',
} as const;

// Notification sound files
export const NOTIFICATION_SOUNDS = {
  chat: 'notification_chat.wav',
  task: 'notification_task.wav',
  reminder: 'notification_reminder.wav',
  alert: 'notification_alert.wav',
  default: 'notification_default.wav',
} as const;

// Notification vibration patterns (ms)
export const VIBRATION_PATTERNS = {
  default: [0, 250, 250, 250],
  chat: [0, 100, 50, 100],
  task: [0, 200, 100, 200],
  reminder: [0, 500, 200, 500],
  alert: [0, 100, 50, 100, 50, 100],
};

// Maximum number of notifications to store
export const MAX_NOTIFICATIONS = 500;

// Notification expiry time (7 days)
export const NOTIFICATION_EXPIRY_DAYS = 7;

// Maximum retry attempts for failed operations
export const MAX_RETRY_ATTEMPTS = 3;

// Retry delay in milliseconds
export const RETRY_DELAY = 1000;

// Offline queue key for AsyncStorage
export const OFFLINE_QUEUE_KEY = '@notification_offline_queue';

// Push token storage key
export const PUSH_TOKEN_KEY = '@notification_push_token';

// Notification settings storage key
export const SETTINGS_KEY = '@notification_settings';
