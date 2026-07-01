import { useState, useEffect } from 'react';
import { notificationService } from '../services/notificationservice';
import { useAuth } from '../contexts/AuthContext';

export function useNotificationBadge() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user?.id) return;

    // Initial load
    notificationService.getUnreadCount(user.id).then(setCount);

    // Listen for changes
    const unsub = notificationService.onBadgeChange(setCount);
    return unsub;
  }, [user?.id]);

  return count;
}
