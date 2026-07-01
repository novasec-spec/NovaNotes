// src/hooks/useDailyGreeting.ts

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dailyGreetingService } from '../services/dailyGreetingService';
import { useNotification } from '../contexts/NotificationContext';
import { AppNotification } from '../types/notifications';

export function useDailyGreeting() {
  const { user } = useAuth();
  const { sendNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  const [greetingSent, setGreetingSent] = useState(false);
  const [lastGreeting, setLastGreeting] = useState<AppNotification | null>(null);

  // Check if greeting was sent today
  const checkGreetingStatus = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const sent = await dailyGreetingService.wasGreetingSentToday();
      setGreetingSent(sent);
    } catch (error) {
      console.error('Error checking greeting status:', error);
    }
  }, [user?.id]);

  // Send daily greeting
  const sendGreeting = useCallback(async () => {
    if (!user?.id) {
      console.error('❌ No user to send greeting');
      return null;
    }

    setLoading(true);

    try {
      const notification = await dailyGreetingService.sendDailyGreeting(user.id);
      
      if (notification) {
        setLastGreeting(notification);
        setGreetingSent(true);
        console.log('✅ Daily greeting sent!');
        return notification;
      } else {
        console.log('⏳ No greeting sent (already sent today or error)');
        return null;
      }
    } catch (error) {
      console.error('❌ Error sending greeting:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Auto-send greeting on app load (optional)
  const sendGreetingOnAppLoad = useCallback(async () => {
    if (!user?.id) return null;
    
    // Check if greeting was already sent
    const alreadySent = await dailyGreetingService.wasGreetingSentToday();
    
    if (!alreadySent) {
      console.log('🌅 Sending daily greeting on app load...');
      return await sendGreeting();
    } else {
      console.log('⏳ Greeting already sent today');
      return null;
    }
  }, [user?.id, sendGreeting]);

  // Reset greeting (for testing)
  const resetGreeting = useCallback(async () => {
    await dailyGreetingService.resetGreeting();
    setGreetingSent(false);
    setLastGreeting(null);
    console.log('🔄 Greeting reset');
  }, []);

  // Check status on mount
  useEffect(() => {
    checkGreetingStatus();
  }, [checkGreetingStatus]);

  return {
    loading,
    greetingSent,
    lastGreeting,
    sendGreeting,
    sendGreetingOnAppLoad,
    resetGreeting,
    checkGreetingStatus,
  };
}
