// src/hooks/notification/useDeepLinkNavigation.ts

import { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { deepLinkHandler } from '../../utils/notification/deepLinkHandler';

// Screen mapping for different notification types
const SCREEN_MAP: Record<string, string> = {
  chat: 'chat',
  task: 'task',
  reminder: 'reminder',
  system: 'notifications',
  profile: 'profile',
  home: 'home',
  settings: 'settings',
  moodmusic: 'moodmusic',
};

export function useDeepLinkNavigation() {
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Mark app as ready after first render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      deepLinkHandler.setAppReady(true);
    }
  }, []);

  // Helper to navigate to a screen with params
  const navigateTo = (screen: string, params?: Record<string, any>) => {
    const mappedScreen = SCREEN_MAP[screen] || screen;
    deepLinkHandler.handleNotification({
      id: '',
      user_id: '',
      title: '',
      body: '',
      type: 'system',
      created_at: '',
      read: false,
      data: { screen: mappedScreen, params },
    } as any);
  };

  // Navigate to chat
  const navigateToChat = (userId: string, message?: string) => {
    router.push({
      pathname: '/chat',
      params: { userId, message },
    } as any);
  };

  // Navigate to task
  const navigateToTask = (taskId: string) => {
    router.push({
      pathname: '/task',
      params: { taskId },
    } as any);
  };

  // Navigate to profile
  const navigateToProfile = (userId: string) => {
    router.push({
      pathname: '/profile',
      params: { userId },
    } as any);
  };

  // Navigate to notifications
  const navigateToNotifications = (filter?: string) => {
    router.push({
      pathname: '/notifications',
      params: { filter },
    } as any);
  };

  // Navigate to settings
  const navigateToSettings = () => {
    router.push('/settings');
  };

  return {
    navigateTo,
    navigateToChat,
    navigateToTask,
    navigateToProfile,
    navigateToNotifications,
    navigateToSettings,
    deepLinkHandler,
  };
}
