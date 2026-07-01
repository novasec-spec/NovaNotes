import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { notificationService } from '../services/notificationservice';
import { useAuth } from '../contexts/AuthContext';

export function useNotifications() {
  const { user } = useAuth();
  const isSetup = useRef(false);

  useEffect(() => {
    if (!user?.id || isSetup.current) return;
    isSetup.current = true;

    // 1. Initialize push
    notificationService.initialize().then(() => {
      notificationService.savePushToken(user.id);
    });

    // 2. Handle notification RECEIVED (app is open/foreground)
    const receivedSub = Notifications.addNotificationReceivedListener(
      async (notification) => {
        console.log('📩 Notification received:', notification);

        const { title, body, data } = notification.request.content;

        // Save to Supabase (even though it might already be there from sender)
        await notificationService.saveIncomingNotification({
          userId: user.id,
          title: title || 'New Notification',
          body: body || '',
          type: data?.type || 'system',
          data: data || {},
        });
      }
    );

    // 3. Handle notification TAP (user presses it)
    const responseSub = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        console.log('👆 Notification tapped:', response);
        const data = response.notification.request.content.data;

        // Save to Supabase if not already there
        const { title, body } = response.notification.request.content;
        await notificationService.saveIncomingNotification({
          userId: user.id,
          title: title || 'New Notification',
          body: body || '',
          type: data?.type || 'system',
          data: data || {},
        });

        handleNotificationTap(data);
      }
    );

    // 4. Check if app was opened FROM a notification (killed state)
    Notifications.getLastNotificationResponseAsync().then(async (response) => {
      if (response?.notification) {
        console.log('🚀 App opened from notification:', response);
        const data = response.notification.request.content.data;
        const { title, body } = response.notification.request.content;

        await notificationService.saveIncomingNotification({
          userId: user.id,
          title: title || 'New Notification',
          body: body || '',
          type: data?.type || 'system',
          data: data || {},
        });

        handleNotificationTap(data);
      }
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [user?.id]);

  function handleNotificationTap(data: any) {
    console.log('🧭 Navigating to:', data?.screen);
    if (data?.screen) {
      router.push(`/${data.screen}`);
    }
  }
// src/hooks/useNotifications.ts (updated handleDeepLink)

function handleDeepLink(data: any) {
  console.log('🧭 Navigating to:', data?.screen);
  
  if (!data?.screen) return;

  if (data.isMoodCheckin) {
    router.push({
      pathname: '/mood-checkin',
      params: {
        type: data.checkin_type || 'followup',
        previousMood: data.previous_mood ? JSON.stringify(data.previous_mood) : undefined,
      },
    } as any);
    return;
  }}
}
