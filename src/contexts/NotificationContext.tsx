// src/contexts/NotificationContext.tsx

import React, { createContext, useContext, useCallback, useEffect, useRef } from 'react';
import { notificationService } from '../services/notification/NotificationService';
import { pushTokenService } from '../services/notification/PushTokenService';
import { useAuth } from './AuthContext';
import { AppNotification, NotificationType, NotificationCategory } from '../types/notifications';
import { useNotifications } from '../hooks/notification/useNotifications';

interface NotificationContextType {
  // Core
  sendNotification: (params: SendNotificationParams) => Promise<AppNotification | null>;
  sendSystem: (title: string, body: string, data?: any) => Promise<AppNotification | null>;
  sendReminder: (title: string, body: string, data?: any) => Promise<AppNotification | null>;
  sendTask: (title: string, body: string, data?: any) => Promise<AppNotification | null>;
  sendChat: (title: string, body: string, data?: any) => Promise<AppNotification | null>;
  
  // With Actions
  sendMessageWithActions: (title: string, body: string, data?: any) => Promise<AppNotification | null>;
  sendTaskWithActions: (title: string, body: string, data?: any) => Promise<AppNotification | null>;
  sendReminderWithActions: (title: string, body: string, data?: any) => Promise<AppNotification | null>;

  // Scheduled
  sendScheduled: (params: SendScheduledParams) => Promise<AppNotification | null>;

  // Bulk
  sendBulk: (notifications: SendNotificationParams[]) => Promise<AppNotification[]>;

  // Utility
  getAll: (userId: string) => Promise<AppNotification[]>;
  getUnreadCount: (userId: string) => Promise<number>;
  markAsRead: (id: string, userId: string) => Promise<void>;
  markAllRead: (userId: string) => Promise<void>;
  delete: (id: string, userId: string) => Promise<void>;
  deleteAll: (userId: string) => Promise<void>;
  
  // Push Token
  registerPushToken: (deviceName?: string) => Promise<string | null>;
  unregisterPushToken: () => Promise<void>;
  getPushToken: () => Promise<string | null>;
  
  // Real-time
  subscribe: (userId: string, onNew: (payload: any) => void) => any;
  unsubscribe: (userId: string) => void;
  
  // Badge
  getBadgeCount: () => number;
  onBadgeChange: (callback: (count: number) => void) => () => void;
}

interface SendNotificationParams {
  userId?: string;
  title: string;
  body: string;
  type: NotificationType;
  data?: Record<string, any>;
  showLocal?: boolean;
  categoryId?: NotificationCategory;
  priority?: 'low' | 'normal' | 'high';
  scheduledFor?: Date;
  expiresAt?: Date;
}

interface SendScheduledParams extends SendNotificationParams {
  scheduledFor: Date;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [badgeCount, setBadgeCount] = React.useState(0);

  // Setup push notifications
  useNotifications();

  // Listen for badge changes
  useEffect(() => {
    if (!user?.id) return;
    
    const unsubscribe = notificationService.onBadgeChange((count) => {
      setBadgeCount(count);
    });

    // Initial badge count
    notificationService.getUnreadCount(user.id).then(setBadgeCount);

    return () => unsubscribe();
  }, [user?.id]);

  // ─── SEND NOTIFICATION ──────────────────────────
  const sendNotification = useCallback(
    async (params: SendNotificationParams): Promise<AppNotification | null> => {
      const targetUserId = params.userId || user?.id;
      if (!targetUserId) {
        console.error('❌ No userId for notification');
        return null;
      }

      return notificationService.create({
        userId: targetUserId,
        title: params.title,
        body: params.body,
        type: params.type,
        data: params.data,
        showLocal: params.showLocal ?? true,
        categoryId: params.categoryId,
        priority: params.priority,
        scheduledFor: params.scheduledFor,
        expiresAt: params.expiresAt,
      });
    },
    [user?.id]
  );

  // ─── BASIC HELPERS ──────────────────────────────
  const sendSystem = useCallback(
    (title: string, body: string, data?: any) =>
      sendNotification({ title, body, type: 'system', data }),
    [sendNotification]
  );

  const sendReminder = useCallback(
    (title: string, body: string, data?: any) =>
      sendNotification({ title, body, type: 'reminder', data }),
    [sendNotification]
  );

  const sendTask = useCallback(
    (title: string, body: string, data?: any) =>
      sendNotification({ title, body, type: 'task', data }),
    [sendNotification]
  );

  const sendChat = useCallback(
    (title: string, body: string, data?: any) =>
      sendNotification({ title, body, type: 'chat', data }),
    [sendNotification]
  );

  // ─── ACTION BUTTON HELPERS ──────────────────────
  const sendMessageWithActions = useCallback(
    (title: string, body: string, data?: any) =>
      sendNotification({ 
        title, 
        body, 
        type: 'chat', 
        data, 
        categoryId: 'message',
        priority: 'high',
      }),
    [sendNotification]
  );

  const sendTaskWithActions = useCallback(
    (title: string, body: string, data?: any) =>
      sendNotification({ 
        title, 
        body, 
        type: 'task', 
        data, 
        categoryId: 'task',
        priority: 'high',
      }),
    [sendNotification]
  );

  const sendReminderWithActions = useCallback(
    (title: string, body: string, data?: any) =>
      sendNotification({ 
        title, 
        body, 
        type: 'reminder', 
        data, 
        categoryId: 'reminder',
        priority: 'high',
      }),
    [sendNotification]
  );

  // ─── SCHEDULED ──────────────────────────────────
  const sendScheduled = useCallback(
    (params: SendScheduledParams) =>
      sendNotification({
        ...params,
        scheduledFor: params.scheduledFor,
      }),
    [sendNotification]
  );

  // ─── BULK ────────────────────────────────────────
  const sendBulk = useCallback(
    async (notifications: SendNotificationParams[]): Promise<AppNotification[]> => {
      const results = await Promise.all(
        notifications.map(params => sendNotification(params))
      );
      return results.filter((n): n is AppNotification => n !== null);
    },
    [sendNotification]
  );

  // ─── PUSH TOKEN ─────────────────────────────────
  const registerPushToken = useCallback(
    async (deviceName?: string) => {
      if (!user?.id) {
        console.error('❌ No user for push token');
        return null;
      }
      return pushTokenService.registerPushToken(user.id, deviceName);
    },
    [user?.id]
  );

  const unregisterPushToken = useCallback(async () => {
    if (!user?.id) {
      console.error('❌ No user for push token');
      return;
    }
    await pushTokenService.unregisterPushToken(user.id);
  }, [user?.id]);

  const getPushToken = useCallback(async () => {
    if (!user?.id) {
      console.error('❌ No user for push token');
      return null;
    }
    return pushTokenService.getPushToken(user.id);
  }, [user?.id]);

  return (
    <NotificationContext.Provider
      value={{
        sendNotification,
        sendSystem,
        sendReminder,
        sendTask,
        sendChat,
        sendMessageWithActions,
        sendTaskWithActions,
        sendReminderWithActions,
        sendScheduled,
        sendBulk,
        getAll: notificationService.getAll.bind(notificationService),
        getUnreadCount: notificationService.getUnreadCount.bind(notificationService),
        markAsRead: notificationService.markAsRead.bind(notificationService),
        markAllRead: notificationService.markAllRead.bind(notificationService),
        delete: notificationService.delete.bind(notificationService),
        deleteAll: notificationService.deleteAll.bind(notificationService),
        registerPushToken,
        unregisterPushToken,
        getPushToken,
        subscribe: notificationService.subscribe.bind(notificationService),
        unsubscribe: notificationService.unsubscribe.bind(notificationService),
        getBadgeCount: () => badgeCount,
        onBadgeChange: notificationService.onBadgeChange.bind(notificationService),
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used inside NotificationProvider');
  }
  return context;
}
