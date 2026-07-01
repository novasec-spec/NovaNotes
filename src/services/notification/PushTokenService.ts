// src/services/notification/PushTokenService.ts

import { supabase } from './NotificationService';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PushTokenRecord {
  id: string;
  user_id: string;
  token: string;
  device_name?: string;
  platform: 'ios' | 'android';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export class PushTokenService {
  private static instance: PushTokenService;
  private cachedToken: string | null = null;
  private userId: string | null = null;

  private constructor() {}

  static getInstance(): PushTokenService {
    if (!PushTokenService.instance) {
      PushTokenService.instance = new PushTokenService();
    }
    return PushTokenService.instance;
  }

  async registerPushToken(userId: string, deviceName?: string): Promise<string | null> {
    try {
      this.userId = userId;
      
      // Get push token
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('❌ Push permission denied');
        return null;
      }

      const token = await Notifications.getExpoPushTokenAsync();
      this.cachedToken = token.data;

      // Save to Supabase
      await this.saveToken(userId, token.data, deviceName);

      // Cache locally
      await AsyncStorage.setItem('push_token', token.data);
      await AsyncStorage.setItem('push_token_user', userId);

      console.log('✅ Push token registered:', token.data);
      return token.data;

    } catch (error) {
      console.error('❌ Failed to register push token:', error);
      return null;
    }
  }

  private async saveToken(userId: string, token: string, deviceName?: string): Promise<void> {
    try {
      const platform = Platform.OS === 'ios' ? 'ios' : 'android';
      
      // Check if token exists
      const { data: existing } = await supabase
        .from('push_tokens')
        .select('id')
        .eq('token', token)
        .single();

      if (existing) {
        // Update existing token
        await supabase
          .from('push_tokens')
          .update({
            user_id: userId,
            device_name: deviceName,
            platform,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        // Create new token
        await supabase
          .from('push_tokens')
          .insert({
            user_id: userId,
            token,
            device_name: deviceName || Platform.OS,
            platform,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
      }

    } catch (error) {
      console.error('Failed to save push token:', error);
    }
  }

  async unregisterPushToken(userId: string): Promise<void> {
    try {
      // Invalidate token
      await supabase
        .from('push_tokens')
        .update({ is_active: false })
        .eq('user_id', userId);

      // Clear cache
      await AsyncStorage.removeItem('push_token');
      await AsyncStorage.removeItem('push_token_user');
      this.cachedToken = null;

      console.log('✅ Push token unregistered');

    } catch (error) {
      console.error('Failed to unregister push token:', error);
    }
  }

  async getPushToken(userId: string): Promise<string | null> {
    try {
      // Check cache
      if (this.cachedToken && this.userId === userId) {
        return this.cachedToken;
      }

      // Check local storage
      const cached = await AsyncStorage.getItem('push_token');
      const cachedUser = await AsyncStorage.getItem('push_token_user');
      if (cached && cachedUser === userId) {
        this.cachedToken = cached;
        this.userId = userId;
        return cached;
      }

      // Check database
      const { data } = await supabase
        .from('push_tokens')
        .select('token')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        this.cachedToken = data.token;
        this.userId = userId;
        return data.token;
      }

      return null;

    } catch (error) {
      console.error('Failed to get push token:', error);
      return null;
    }
  }

  async getDeviceTokens(userId: string): Promise<PushTokenRecord[]> {
    try {
      const { data, error } = await supabase
        .from('push_tokens')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];

    } catch (error) {
      console.error('Failed to get device tokens:', error);
      return [];
    }
  }

  async refreshToken(userId: string): Promise<string | null> {
    await this.unregisterPushToken(userId);
    return this.registerPushToken(userId);
  }
}

export const pushTokenService = PushTokenService.getInstance();
