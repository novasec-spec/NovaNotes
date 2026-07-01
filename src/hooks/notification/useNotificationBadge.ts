// src/hooks/notification/useNotificationBadge.ts

import { useState, useEffect, useCallback } from 'react';
import { notificationService } from '../../services/notification/NotificationService';
import { useAuth } from '../../contexts/AuthContext';

export function useNotificationBadge() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const updateCount = useCallback(async () => {
    if (!user?.id) {
      setCount(0);
      setLoading(false);
      return;
    }

    try {
      const newCount = await notificationService.getUnreadCount(user.id);
      setCount(newCount);
    } catch (error) {
      console.error('Error updating badge count:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Initial load
  useEffect(() => {
    updateCount();
  }, [updateCount]);

  // Listen for badge changes
  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = notificationService.onBadgeChange((newCount) => {
      setCount(newCount);
    });

    return () => unsubscribe();
  }, [user?.id]);

  // Manual refresh
  const refresh = useCallback(async () => {
    await updateCount();
  }, [updateCount]);

  // Increment count
  const increment = useCallback(() => {
    setCount(prev => prev + 1);
  }, []);

  // Decrement count
  const decrement = useCallback(() => {
    setCount(prev => Math.max(0, prev - 1));
  }, []);

  // Reset count
  const reset = useCallback(() => {
    setCount(0);
  }, []);

  return {
    count,
    loading,
    refresh,
    increment,
    decrement,
    reset,
    hasNotifications: count > 0,
  };
}
