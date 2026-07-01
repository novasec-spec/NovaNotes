// src/hooks/notification/useNotificationSettings.ts

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/notification/NotificationService';
import { useAuth } from '../../contexts/AuthContext';
import { NotificationCategory } from '../../types/notifications';

interface NotificationSettings {
  categories: {
    [key in NotificationCategory]?: {
      enabled: boolean;
      sound: boolean;
      vibration: boolean;
      priority: 'low' | 'normal' | 'high';
    };
  };
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
  general: {
    showBanners: boolean;
    showBadges: boolean;
    playSounds: boolean;
    vibrate: boolean;
  };
}

const DEFAULT_SETTINGS: NotificationSettings = {
  categories: {
    message: { enabled: true, sound: true, vibration: true, priority: 'high' },
    task: { enabled: true, sound: true, vibration: true, priority: 'high' },
    reminder: { enabled: true, sound: true, vibration: true, priority: 'normal' },
    system: { enabled: true, sound: false, vibration: false, priority: 'normal' },
    social: { enabled: true, sound: true, vibration: true, priority: 'normal' },
  },
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '08:00',
  },
  general: {
    showBanners: true,
    showBadges: true,
    playSounds: true,
    vibrate: true,
  },
};

export function useNotificationSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load settings
  useEffect(() => {
    if (!user?.id) return;
    loadSettings();
  }, [user?.id]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows found
        throw error;
      }

      if (data) {
        // Merge with defaults to ensure all fields exist
        setSettings({
          ...DEFAULT_SETTINGS,
          ...data,
          categories: {
            ...DEFAULT_SETTINGS.categories,
            ...data.categories,
          },
          quietHours: {
            ...DEFAULT_SETTINGS.quietHours,
            ...data.quiet_hours,
          },
        });
      } else {
        // No settings found, use defaults
        setSettings(DEFAULT_SETTINGS);
      }
    } catch (err) {
      console.error('Error loading notification settings:', err);
      setError('Failed to load settings');
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = useCallback(async () => {
    if (!user?.id) {
      setError('No user logged in');
      return false;
    }

    try {
      setLoading(true);
      setError(null);

      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          categories: settings.categories,
          quiet_hours: settings.quietHours,
          general: settings.general,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      console.log('✅ Notification settings saved');
      return true;
    } catch (err) {
      console.error('Error saving notification settings:', err);
      setError('Failed to save settings');
      return false;
    } finally {
      setLoading(false);
    }
  }, [user?.id, settings]);

  const updateCategory = useCallback((
    category: NotificationCategory,
    updates: Partial<NotificationSettings['categories'][NotificationCategory]>
  ) => {
    setSettings(prev => ({
      ...prev,
      categories: {
        ...prev.categories,
        [category]: {
          ...prev.categories[category],
          ...updates,
        } as any,
      },
    }));
  }, []);

  const updateQuietHours = useCallback((
    updates: Partial<NotificationSettings['quietHours']>
  ) => {
    setSettings(prev => ({
      ...prev,
      quietHours: {
        ...prev.quietHours,
        ...updates,
      },
    }));
  }, []);

  const updateGeneral = useCallback((
    updates: Partial<NotificationSettings['general']>
  ) => {
    setSettings(prev => ({
      ...prev,
      general: {
        ...prev.general,
        ...updates,
      },
    }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const isCategoryEnabled = useCallback((category: NotificationCategory) => {
    return settings.categories[category]?.enabled ?? true;
  }, [settings]);

  const shouldShowNotification = useCallback((
    category: NotificationCategory,
    priority: 'low' | 'normal' | 'high' = 'normal'
  ) => {
    // Check if category is enabled
    if (!isCategoryEnabled(category)) return false;

    // Check quiet hours
    if (settings.quietHours.enabled) {
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();
      
      const [startHour, startMin] = settings.quietHours.start.split(':').map(Number);
      const [endHour, endMin] = settings.quietHours.end.split(':').map(Number);
      
      const startTime = startHour * 60 + startMin;
      const endTime = endHour * 60 + endMin;
      
      let isQuiet = false;
      if (startTime < endTime) {
        isQuiet = currentTime >= startTime && currentTime < endTime;
      } else {
        // Covers midnight
        isQuiet = currentTime >= startTime || currentTime < endTime;
      }
      
      if (isQuiet && priority === 'normal') {
        return false;
      }
    }

    return true;
  }, [settings, isCategoryEnabled]);

  return {
    settings,
    loading,
    error,
    saveSettings,
    updateCategory,
    updateQuietHours,
    updateGeneral,
    resetToDefaults,
    isCategoryEnabled,
    shouldShowNotification,
  };
}
