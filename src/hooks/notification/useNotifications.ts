// src/hooks/notification/useNotifications.ts

import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { notificationService } from '../../services/notification/NotificationService';
import { pushTokenService } from '../../services/notification/PushTokenService';
import { useAuth } from '../../contexts/AuthContext';
import { deepLinkHandler } from '../../utils/notification/deepLinkHandler';

export function useNotifications() {
  const { user } = useAuth();
  const isSetup = useRef(false);

  // Handle deep link navigation
  const handleDeepLink = (data: any) => {
    console.log('🧭 Deep linking to:', data?.screen);

    const screen = data?.screen;
    const params = data?.params || {};

    if (!screen) {
      // Default fallback
      router.push('/notifications' as any);
      return;
    }

    try {
      // Build route with params
      let route = `/${screen}`;
      
      // Add params as query string
      if (params && Object.keys(params).length > 0) {
        const queryString = Object.entries(params)
          .filter(([_, value]) => value !== undefined && value !== null)
          .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
          .join('&');
        
        if (queryString) {
          route += `?${queryString}`;
        }
      }

      // Navigate
      router.push(route as any);
    } catch (error) {
      console.error('❌ Navigation error:', error);
      // Fallback to notifications screen
      router.push('/notifications' as any);
    }
  };

  useEffect(() => {
    if (!user?.id || isSetup.current) return;
    isSetup.current = true;

    // 1. Initialize push
    const initPush = async () => {
      try {
        const token = await notificationService.initialize();
        if (token) {
          await pushTokenService.registerPushToken(user.id, Platform.OS);
          console.log('✅ Push token registered:', token);
        }
      } catch (error) {
        console.error('❌ Push init error:', error);
      }
    };

    initPush();

    // 2. Handle notification RECEIVED (app is open/foreground)
    const receivedSub = Notifications.addNotificationReceivedListener(
      async (notification) => {
        console.log('📩 Notification received:', notification);
        const { title, body, data } = notification.request.content;

        await notificationService.create({
          userId: user.id,
          title: title || 'New Notification',
          body: body || '',
          type: data?.type || 'system',
          data: { ...data, received: true },
          showLocal: false,
        });
      }
    );

    // 3. Handle notification TAP (user presses it)
    const responseSub = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        console.log('👆 Notification tapped:', response);
        const data = response.notification.request.content.data;
        const { title, body } = response.notification.request.content;

        // Save to Supabase
        await notificationService.create({
          userId: user.id,
          title: title || 'New Notification',
          body: body || '',
          type: data?.type || 'system',
          data: { ...data, opened: true },
          showLocal: false,
        });

        // Track open
        if (data?.notificationId) {
          await notificationService.trackOpen(data.notificationId);
        }

        // ✅ NAVIGATE
        handleDeepLink(data);
      }
    );

    // 4. Check if app was opened FROM a notification (killed state)
    Notifications.getLastNotificationResponseAsync().then(async (response) => {
      if (response?.notification) {
        console.log('🚀 App opened from notification:', response);
        const data = response.notification.request.content.data;
        const { title, body } = response.notification.request.content;

        await notificationService.create({
          userId: user.id,
          title: title || 'New Notification',
          body: body || '',
          type: data?.type || 'system',
          data: { ...data, openedFromKilled: true },
          showLocal: false,
        });

        // ✅ NAVIGATE (with delay to ensure app is ready)
        setTimeout(() => {
          handleDeepLink(data);
        }, 500);
      }
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [user?.id]);
}
