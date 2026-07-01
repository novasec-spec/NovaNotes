// src/hooks/notification/usePushNotifications.ts

import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { notificationService } from '../../services/notification/NotificationService';
import { pushTokenService } from '../../services/notification/PushTokenService';
import { useAuth } from '../../contexts/AuthContext';

export function usePushNotifications() {
  const { user } = useAuth();
  const isSetup = useRef(false);

  useEffect(() => {
    if (!user?.id || isSetup.current) return;
    isSetup.current = true;

    // 1. Initialize push notifications
    const initPush = async () => {
      try {
        // Initialize notification service
        const token = await notificationService.initialize();
        
        if (token) {
          // Register push token
          await pushTokenService.registerPushToken(user.id, 'My Device');
          console.log('✅ Push notifications initialized');
        }
      } catch (error) {
        console.error('❌ Failed to initialize push:', error);
      }
    };

    initPush();

    // 2. Handle notification RECEIVED (app is open/foreground)
    const receivedSub = Notifications.addNotificationReceivedListener(
      async (notification) => {
        console.log('📩 Notification received:', notification);

        const { title, body, data } = notification.request.content;

        // Save to Supabase
        await notificationService.create({
          userId: user.id,
          title: title || 'New Notification',
          body: body || '',
          type: data?.type || 'system',
          data: { ...data, received: true },
          showLocal: false, // Don't show again
        });
      }
    );

    // 3. Handle notification TAP (user presses it)
    const responseSub = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        console.log('👆 Notification tapped:', response);
        const data = response.notification.request.content.data;
        const { title, body } = response.notification.request.content;

        // Track open
        if (data?.notificationId) {
          await notificationService.trackOpen(data.notificationId);
        }

        // Handle navigation
        handleDeepLink(data);
      }
    );

    // 4. Check if app was opened FROM a notification (killed state)
    Notifications.getLastNotificationResponseAsync().then(async (response) => {
      if (response?.notification) {
        console.log('🚀 App opened from notification:', response);
        const data = response.notification.request.content.data;
        const { title, body } = response.notification.request.content;

        // Save to Supabase
        await notificationService.create({
          userId: user.id,
          title: title || 'New Notification',
          body: body || '',
          type: data?.type || 'system',
          data: { ...data, openedFromKilled: true },
          showLocal: false,
        });

        // Handle navigation with delay (app needs to mount)
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

  function handleDeepLink(data: any) {
    console.log('🧭 Navigating to:', data?.screen);
    
    if (!data?.screen) return;

    // Navigate based on screen
    switch (data.screen) {
      case 'chat':
        if (data.params?.userId) {
          router.push(`/chat/${data.params.userId}`);
        } else {
          router.push('/chat');
        }
        break;
      
      case 'task':
        if (data.params?.taskId) {
          router.push(`/task/${data.params.taskId}`);
        } else {
          router.push('/tasks');
        }
        break;
      
      case 'notification':
        router.push('/notifications');
        break;
      
      case 'settings':
        router.push('/settings');
        break;
      
      default:
        // Try to navigate to the screen
        try {
          router.push(`/${data.screen}`);
        } catch (error) {
          console.error('Failed to navigate to:', data.screen);
        }
    }
  }
}
