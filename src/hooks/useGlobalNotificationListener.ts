import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { notificationService } from '../services/notificationservice';
import { useAuth } from '../contexts/AuthContext';

/**
 * GLOBAL NOTIFICATION LISTENER
 * 
 * Catches notifications from ANY source:
 * - Local notifications (scheduled in app)
 * - Push notifications (from Expo push server)
 * - Background notifications
 * - Killed-state notifications
 * 
 * ALL of them get saved to Supabase.
 */
export function useGlobalNotificationListener() {
  const { user } = useAuth();
  const isSetup = useRef(false);

  useEffect(() => {
    if (!user?.id || isSetup.current) return;
    isSetup.current = true;

    console.log('🔔 GLOBAL LISTENER ACTIVE for user:', user.id);

    // ─── 1. APP IS OPEN (foreground) ─────────────────────
    const foregroundSub = Notifications.addNotificationReceivedListener(
      async (notification) => {
        console.log('📩 FOREGROUND notification:', notification.request.content.title);

        const { title, body, data } = notification.request.content;

        await notificationService.saveToSupabase({
          userId: user.id,
          title: title || 'Notification',
          body: body || '',
          type: (data?.type as any) || 'system',
          data: data as any,
        });
      }
    );

    // ─── 2. USER TAPS NOTIFICATION ───────────────────────
    const tapSub = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        console.log('👆 TAPPED notification:', response.notification.request.content.title);

        const { title, body, data } = response.notification.request.content;

        // Save (in case it wasn't saved in foreground)
        await notificationService.saveToSupabase({
          userId: user.id,
          title: title || 'Notification',
          body: body || '',
          type: (data?.type as any) || 'system',
          data: data as any,
        });
      }
    );

    // ─── 3. APP OPENED FROM KILLED STATE ─────────────────
    Notifications.getLastNotificationResponseAsync().then(async (response) => {
      if (response?.notification) {
        console.log('🚀 KILLED-STATE notification:', response.notification.request.content.title);

        const { title, body, data } = response.notification.request.content;

        await notificationService.saveToSupabase({
          userId: user.id,
          title: title || 'Notification',
          body: body || '',
          type: (data?.type as any) || 'system',
          data: data as any,
        });
      }
    });

    // ─── 4. SCHEDULED LOCAL NOTIFICATIONS TRIGGER ────────
    // This catches any local notifications that fire
    const scheduledSub = Notifications.addNotificationReceivedListener(
      async (notification) => {
        // Only handle if it's a scheduled one (has 'scheduled' in data)
        if (notification.request.content.data?.scheduled) {
          console.log('⏰ SCHEDULED notification fired:', notification.request.content.title);

          const { title, body, data } = notification.request.content;

          await notificationService.saveToSupabase({
            userId: user.id,
            title: title || 'Reminder',
            body: body || '',
            type: 'reminder',
            data: data as any,
          });
        }
      }
    );

    return () => {
      console.log('🔕 Cleaning up global listener');
      foregroundSub.remove();
      tapSub.remove();
      scheduledSub.remove();
    };
  }, [user?.id]);
}
