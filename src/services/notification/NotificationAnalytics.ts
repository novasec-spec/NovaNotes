// src/services/notification/NotificationAnalytics.ts

import { supabase } from './NotificationService';

interface AnalyticsData {
  totalReceived: number;
  totalOpened: number;
  totalActions: number;
  openRate: number;
  actionRate: number;
  topCategories: Array<{ category: string; count: number }>;
  dailyStats: Array<{ date: string; count: number }>;
  topActions: Array<{ action: string; count: number }>;
}

export class NotificationAnalyticsService {
  private static instance: NotificationAnalyticsService;

  static getInstance() {
    if (!NotificationAnalyticsService.instance) {
      NotificationAnalyticsService.instance = new NotificationAnalyticsService();
    }
    return NotificationAnalyticsService.instance;
  }

  async trackEvent(
    notificationId: string,
    userId: string,
    action: 'received' | 'opened' | 'dismissed' | 'action',
    actionIdentifier?: string,
    metadata?: Record<string, any>
  ) {
    try {
      await supabase
        .from('notification_analytics')
        .insert({
          notification_id: notificationId,
          user_id: userId,
          action,
          action_identifier: actionIdentifier,
          timestamp: new Date().toISOString(),
          metadata: metadata || {},
        });
    } catch (error) {
      console.error('Failed to track analytics:', error);
    }
  }

  async getUserAnalytics(userId: string, days = 30): Promise<AnalyticsData> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get all analytics
      const { data: analytics } = await supabase
        .from('notification_analytics')
        .select('*')
        .eq('user_id', userId)
        .gte('timestamp', startDate.toISOString());

      if (!analytics) return this.getEmptyAnalytics();

      // Calculate stats
      const received = analytics.filter(a => a.action === 'received');
      const opened = analytics.filter(a => a.action === 'opened');
      const actions = analytics.filter(a => a.action === 'action');
      const dismissed = analytics.filter(a => a.action === 'dismissed');

      // Category breakdown
      const categoryCount: Record<string, number> = {};
      const actionCount: Record<string, number> = {};

      for (const item of analytics) {
        const category = item.metadata?.category || 'unknown';
        categoryCount[category] = (categoryCount[category] || 0) + 1;
        
        if (item.action_identifier) {
          actionCount[item.action_identifier] = (actionCount[item.action_identifier] || 0) + 1;
        }
      }

      // Daily stats
      const dailyStats: Record<string, number> = {};
      for (const item of analytics) {
        const date = new Date(item.timestamp).toISOString().split('T')[0];
        dailyStats[date] = (dailyStats[date] || 0) + 1;
      }

      return {
        totalReceived: received.length,
        totalOpened: opened.length,
        totalActions: actions.length,
        openRate: received.length > 0 ? (opened.length / received.length) * 100 : 0,
        actionRate: received.length > 0 ? (actions.length / received.length) * 100 : 0,
        topCategories: Object.entries(categoryCount)
          .map(([category, count]) => ({ category, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
        dailyStats: Object.entries(dailyStats)
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        topActions: Object.entries(actionCount)
          .map(([action, count]) => ({ action, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
      };

    } catch (error) {
      console.error('Error getting analytics:', error);
      return this.getEmptyAnalytics();
    }
  }

  private getEmptyAnalytics(): AnalyticsData {
    return {
      totalReceived: 0,
      totalOpened: 0,
      totalActions: 0,
      openRate: 0,
      actionRate: 0,
      topCategories: [],
      dailyStats: [],
      topActions: [],
    };
  }

  async getEngagementScore(userId: string): Promise<number> {
    const analytics = await this.getUserAnalytics(userId, 7);
    // Calculate score based on open rate and action rate
    const openScore = (analytics.openRate / 100) * 50;
    const actionScore = (analytics.actionRate / 100) * 50;
    return Math.round(openScore + actionScore);
  }
}

export const notificationAnalytics = NotificationAnalyticsService.getInstance();
