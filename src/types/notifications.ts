// src/types/notifications.ts

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  data?: NotificationData;
  created_at: string;
  read: boolean;
  type: NotificationType;
  category?: NotificationCategory;
  priority?: 'low' | 'normal' | 'high';
  scheduled_for?: string;
  expires_at?: string;
}

export type NotificationType = 'reminder' | 'system' | 'chat' | 'chat_message' | 'task' | 'alert' | 'progress';

export type NotificationCategory = 'message' | 'task' | 'reminder' | 'system' | 'social';

export interface NotificationData {
  screen?: string;
  params?: Record<string, any>;
  notificationId?: string;
  userId?: string;
  progress?: number;
  total?: number;
  image?: string;
  [key: string]: any;
}

export interface PushToken {
  id: string;
  user_id: string;
  token: string;
  device_name?: string;
  platform: 'ios' | 'android';
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface NotificationPreferences {
  user_id: string;
  categories: {
    [key in NotificationCategory]?: {
      enabled: boolean;
      sound: boolean;
      vibration: boolean;
      priority: 'low' | 'normal' | 'high';
    };
  };
  quiet_hours?: {
    start: string;
    end: string;
    enabled: boolean;
  };
}

export interface ScheduledNotification {
  id: string;
  notification_id: string;
  scheduled_for: string;
  delivered: boolean;
  created_at: string;
}

export interface NotificationAction {
  identifier: string;
  title: string;
  icon?: string;
  destructive?: boolean;
  requiresAuth?: boolean;
  handler?: (notification: AppNotification) => Promise<void>;
}

export interface NotificationAnalytics {
  id: string;
  notification_id: string;
  action: 'received' | 'opened' | 'dismissed' | 'action';
  action_identifier?: string;
  timestamp: string;
  user_id: string;
  metadata?: Record<string, any>;
}
