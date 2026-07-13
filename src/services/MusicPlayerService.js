// src/services/MusicPlayerService.js
import TrackPlayer, { 
  Event, 
  State, 
  RepeatMode,
  AppKilledPlaybackBehavior,
} from 'react-native-track-player';
const { Capability } = require('react-native-track-player');
class MusicPlayerService {
  static async setupPlayer() {
    try {
      // Configure for background playback
      await TrackPlayer.setupPlayer({
        maxBuffer: 5000,
        minBuffer: 1000,
        playBuffer: 2000,
        autoUpdateMetadata: true,
      });

      // Keep playing when app is killed
      await TrackPlayer.updateOptions({
        android: {
          appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
          alwaysPauseOnInterruption: true,
        },
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.Stop,
          Capability.SeekTo,
        ],
        compactCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
        ],
        notificationCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.SeekTo,
        ],
        progressUpdateEventInterval: 1,
        // You can customize the notification appearance
        icon: require('../../assets/notification_icon.png'),
      });

      console.log('✅ Music Player Service Ready');
      return true;
    } catch (error) {
      console.error('❌ Failed to setup player:', error);
      return false;
    }
  }

  static async playTrack(track) {
    try {
      await TrackPlayer.reset();
      await TrackPlayer.add({
        id: track.id || Date.now().toString(),
        url: track.url,
        title: track.title || 'Unknown Track',
        artist: track.artist || 'Unknown Artist',
        album: track.album || '',
        artwork: track.artwork || null,
        duration: track.duration || 0,
        genre: track.genre || '',
        isLiveStream: track.isLiveStream || false,
        // Android-specific
        android: {
          isLiveStream: track.isLiveStream || false,
        },
      });
      
      await TrackPlayer.play();
      console.log(`▶️ Playing: ${track.title} - ${track.artist}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to play track:', error);
      return false;
    }
  }

  static async playQueue(tracks, startIndex = 0) {
    try {
      await TrackPlayer.reset();
      await TrackPlayer.add(tracks);
      if (startIndex > 0) {
        await TrackPlayer.skip(startIndex);
      }
      await TrackPlayer.play();
      return true;
    } catch (error) {
      console.error('❌ Failed to play queue:', error);
      return false;
    }
  }

  static async addToQueue(tracks) {
    try {
      await TrackPlayer.add(tracks);
      return true;
    } catch (error) {
      console.error('❌ Failed to add to queue:', error);
      return false;
    }
  }

  static async play() {
    try {
      await TrackPlayer.play();
      return true;
    } catch (error) {
      console.error('❌ Failed to play:', error);
      return false;
    }
  }

  static async pause() {
    try {
      await TrackPlayer.pause();
      return true;
    } catch (error) {
      console.error('❌ Failed to pause:', error);
      return false;
    }
  }

  static async togglePlay() {
    try {
      const state = await TrackPlayer.getState();
      if (state === State.Playing) {
        await TrackPlayer.pause();
      } else {
        await TrackPlayer.play();
      }
      return true;
    } catch (error) {
      console.error('❌ Failed to toggle play:', error);
      return false;
    }
  }

  static async skipToNext() {
    try {
      const queue = await TrackPlayer.getQueue();
      const currentTrack = await TrackPlayer.getCurrentTrack();
      if (currentTrack !== null && currentTrack < queue.length - 1) {
        await TrackPlayer.skipToNext();
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Failed to skip to next:', error);
      return false;
    }
  }

  static async skipToPrevious() {
    try {
      const position = await TrackPlayer.getPosition();
      if (position > 3) {
        await TrackPlayer.seekTo(0);
      } else {
        await TrackPlayer.skipToPrevious();
      }
      return true;
    } catch (error) {
      console.error('❌ Failed to skip to previous:', error);
      return false;
    }
  }

  static async seekTo(position) {
    try {
      await TrackPlayer.seekTo(position);
      return true;
    } catch (error) {
      console.error('❌ Failed to seek:', error);
      return false;
    }
  }

  static async getCurrentTrack() {
    try {
      const track = await TrackPlayer.getCurrentTrack();
      if (track !== null) {
        const info = await TrackPlayer.getTrack(track);
        const state = await TrackPlayer.getState();
        const position = await TrackPlayer.getPosition();
        const duration = await TrackPlayer.getDuration();
        
        return {
          ...info,
          state,
          position: position || 0,
          duration: duration || info.duration || 0,
          isPlaying: state === State.Playing,
          isLoading: state === State.Buffering || state === State.Connecting,
        };
      }
      return null;
    } catch (error) {
      console.error('❌ Failed to get current track:', error);
      return null;
    }
  }

  static async getQueue() {
    try {
      return await TrackPlayer.getQueue();
    } catch (error) {
      console.error('❌ Failed to get queue:', error);
      return [];
    }
  }

  static async setRepeatMode(mode) {
    try {
      const repeatMap = {
        off: RepeatMode.Off,
        all: RepeatMode.Queue,
        one: RepeatMode.Track,
      };
      await TrackPlayer.setRepeatMode(repeatMap[mode] || RepeatMode.Off);
      return true;
    } catch (error) {
      console.error('❌ Failed to set repeat mode:', error);
      return false;
    }
  }

  static async setShuffleMode(shuffle) {
    try {
      await TrackPlayer.setShuffleMode(shuffle ? 'shuffle' : 'off');
      return true;
    } catch (error) {
      console.error('❌ Failed to set shuffle mode:', error);
      return false;
    }
  }

  static async stop() {
    try {
      await TrackPlayer.stop();
      await TrackPlayer.reset();
      return true;
    } catch (error) {
      console.error('❌ Failed to stop:', error);
      return false;
    }
  }

  static async getState() {
    try {
      return await TrackPlayer.getState();
    } catch (error) {
      console.error('❌ Failed to get state:', error);
      return State.None;
    }
  }

  static getPosition() {
    return TrackPlayer.getPosition();
  }

  static getDuration() {
    return TrackPlayer.getDuration();
  }

  static addEventListener(event, listener) {
    return TrackPlayer.addEventListener(event, listener);
  }

  static removeEventListener(event, listener) {
    return TrackPlayer.removeEventListener(event, listener);
  }
}

export default MusicPlayerService;
