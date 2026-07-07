// src/hooks/useCallNotifications.ts
import { useState, useEffect, useCallback } from 'react';
import { EventEmitter } from 'events';
import CallService from '../services/CallService';
import { router } from 'expo-router';

interface CallNotificationData {
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  type: 'audio' | 'video';
}

export function useCallNotifications() {
  const [notification, setNotification] = useState<CallNotificationData | null>(null);

  useEffect(() => {
    const handleIncomingCall = (data: CallNotificationData) => {
      setNotification(data);
    };

    CallService.on('incoming_call', handleIncomingCall);

    return () => {
      CallService.off('incoming_call', handleIncomingCall);
    };
  }, []);

  const clearNotification = useCallback(() => {
    setNotification(null);
  }, []);

  const acceptCall = useCallback(async (callId: string) => {
    try {
      const tokenData = await CallService.acceptCall(callId);
      if (tokenData) {
        router.push({
          pathname: '/call/ActiveCallScreen',
          params: {
            callId,
            callerId: notification?.callerId,
            callerName: notification?.callerName,
            calleeId: tokenData.identity,
            calleeName: tokenData.displayName,
            type: notification?.type || 'video',
            isCaller: 'false',
          },
        });
        clearNotification();
      }
    } catch (error) {
      console.error('Accept call error:', error);
    }
  }, [notification, clearNotification]);

  const declineCall = useCallback(async (callId: string) => {
    await CallService.declineCall(callId);
    clearNotification();
  }, [clearNotification]);

  return {
    notification,
    clearNotification,
    acceptCall,
    declineCall,
  };
}
