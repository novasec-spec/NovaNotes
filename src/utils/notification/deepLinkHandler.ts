// src/utils/notification/deepLinkHandler.ts

import { router } from 'expo-router';
import { AppNotification } from '../../types/notifications';

interface DeepLinkConfig {
  screen: string;
  params?: Record<string, any>;
  fallbackScreen?: string;
}

export class DeepLinkHandler {
  private static instance: DeepLinkHandler;
  private pendingLinks: DeepLinkConfig[] = [];
  private isAppReady = false;

  private constructor() {}

  static getInstance(): DeepLinkHandler {
    if (!DeepLinkHandler.instance) {
      DeepLinkHandler.instance = new DeepLinkHandler();
    }
    return DeepLinkHandler.instance;
  }

  // Set app ready state
  setAppReady(ready: boolean) {
    this.isAppReady = ready;
    if (ready && this.pendingLinks.length > 0) {
      this.processPendingLinks();
    }
  }

  // Handle deep link from notification
  handleNotification(notification: AppNotification): boolean {
    const screen = notification.data?.screen;
    const params = notification.data?.params || {};

    if (!screen) return false;

    const config: DeepLinkConfig = {
      screen,
      params,
      fallbackScreen: notification.data?.fallbackScreen || 'notifications',
    };

    if (this.isAppReady) {
      this.navigate(config);
    } else {
      this.pendingLinks.push(config);
      console.log(`📌 Pending deep link: ${screen}`);
    }

    return true;
  }

  // Navigate to screen
  private navigate(config: DeepLinkConfig) {
    console.log(`🧭 Navigating to: ${config.screen}`, config.params);

    try {
      // Build route with params
      let route = `/${config.screen}`;
      
      // Add params if any
      if (config.params && Object.keys(config.params).length > 0) {
        const queryString = Object.entries(config.params)
          .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
          .join('&');
        route += `?${queryString}`;
      }

      router.push(route as any);
    } catch (error) {
      console.error('❌ Navigation failed:', error);
      // Fallback
      if (config.fallbackScreen) {
        router.push(`/${config.fallbackScreen}` as any);
      }
    }
  }

  // Process pending links
  private processPendingLinks() {
    console.log(`📌 Processing ${this.pendingLinks.length} pending links`);
    for (const link of this.pendingLinks) {
      this.navigate(link);
    }
    this.pendingLinks = [];
  }

  // Clear pending links
  clearPendingLinks() {
    this.pendingLinks = [];
  }

  // Get pending link count
  getPendingLinkCount(): number {
    return this.pendingLinks.length;
  }
}

export const deepLinkHandler = DeepLinkHandler.getInstance();
