// components/CallPushHandler.tsx
import React, { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { useCall } from '../contexts/CallContext';
import { router } from 'expo-router';

export function CallPushHandler() {
  const { handlePushInvite } = useCall();

  useEffect(() => {
    // Foreground/background notification received
    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data;
      if (data?.type === 'call_invite') {
        handlePushInvite(data);
        // Navigate to call screen if not already there
        router.push('/call');
      }
    });

    // User taps notification
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === 'call_invite') {
        handlePushInvite(data);
        router.push('/call');
      }
    });

    // Cold start - app killed, opened via notification
    Notifications.getLastNotificationResponseAsync().then((response) => {
      const data = response?.notification.request.content.data;
      if (data?.type === 'call_invite') {
        handlePushInvite(data);
        router.push('/call');
      }
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [handlePushInvite]);

  return null;
}
