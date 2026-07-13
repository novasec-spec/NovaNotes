// src/services/NowPlayingService.ts
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export interface NowPlayingData {
  title: string;
  artist: string;
  album?: string;
  artwork?: string;
  isPlaying: boolean;
  duration?: number;
  position?: number;
  onPlayPause: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onSeek?: (position: number) => void;
}

class NowPlayingService {
  private static instance: NowPlayingService;
  private currentData: NowPlayingData | null = null;
  private isActive: boolean = false;

  static getInstance(): NowPlayingService {
    if (!NowPlayingService.instance) {
      NowPlayingService.instance = new NowPlayingService();
    }
    return NowPlayingService.instance;
  }

  async showNowPlaying(data: NowPlayingData) {
    this.currentData = data;
    this.isActive = true;

    if (Platform.OS === 'android') {
      await this.showAndroidNowPlaying(data);
    } else {
      // iOS - uses system media player
      await this.showIOSNowPlaying(data);
    }
  }

  private async showAndroidNowPlaying(data: NowPlayingData) {
    try {
      // Create notification channel for media
      await Notifications.setNotificationChannelAsync('media', {
        name: 'Now Playing',
        importance: Notifications.AndroidImportance.HIGH,
        bypassDnd: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        sound: false,
      });

      // Show notification with media controls
      await Notifications.scheduleNotificationAsync({
        content: {
          title: data.title,
          body: `${data.artist}${data.album ? ` • ${data.album}` : ''}`,
          data: { type: 'now_playing' },
          categoryIdentifier: 'media',
          sound: false,
          // On Android, you can set priority
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null, // Show immediately
      });

      // Register media actions
      await Notifications.setNotificationCategoryAsync('media', [
        {
          identifier: 'PLAY_PAUSE',
          buttonTitle: data.isPlaying ? '⏸️ Pause' : '▶️ Play',
          options: {
            opensAppToForeground: false,
          },
        },
        {
          identifier: 'NEXT',
          buttonTitle: '⏭️ Next',
          options: {
            opensAppToForeground: false,
          },
        },
        {
          identifier: 'PREVIOUS',
          buttonTitle: '⏮️ Previous',
          options: {
            opensAppToForeground: false,
          },
        },
        {
          identifier: 'CLOSE',
          buttonTitle: '❌ Close',
          options: {
            opensAppToForeground: false,
            isDestructive: true,
          },
        },
      ]);

    } catch (error) {
      console.error('Failed to show Now Playing notification:', error);
    }
  }

  private async showIOSNowPlaying(data: NowPlayingData) {
    // iOS uses AVPlayer or MPRemoteCommandCenter
    // This is a simplified version
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: data.title,
          body: `${data.artist}`,
          data: { type: 'now_playing' },
          sound: false,
          categoryIdentifier: 'media_ios',
        },
        trigger: null,
      });
    } catch (error) {
      console.error('Failed to show iOS Now Playing:', error);
    }
  }

  async updateNowPlaying(data: NowPlayingData) {
    if (this.isActive) {
      // Update the notification
      await this.showNowPlaying(data);
    }
  }

  async hideNowPlaying() {
    this.isActive = false;
    this.currentData = null;
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  async togglePlayPause() {
    if (this.currentData) {
      this.currentData.isPlaying = !this.currentData.isPlaying;
      this.currentData.onPlayPause();
      await this.updateNowPlaying(this.currentData);
    }
  }

  getCurrentTrack(): NowPlayingData | null {
    return this.currentData;
  }

  isShowing(): boolean {
    return this.isActive;
  }
}

export default NowPlayingService.getInstance();
